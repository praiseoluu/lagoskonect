<?php

/**
 * WithdrawalController — cashing out referral earnings.
 *
 * Citizen side: save a payout account, see the available balance, request a
 * withdrawal, review past requests.
 *
 * Admin side: work the queue, see exactly where to send the money, and mark a
 * request paid once the transfer has actually been made. Marking it paid is
 * what permanently reduces the citizen's balance and triggers their email.
 *
 * Balances are derived rather than stored — earnings are referral_count times
 * the per-referral rate — so a request reserves its amount from the moment it
 * is submitted. Otherwise the same balance could be requested twice before an
 * admin has processed either one.
 */
class WithdrawalController {

    /** Naira paid per verified referral. Mirrors ReferralController. */
    private const RATE = 250;

    /** Smallest amount worth a bank transfer. */
    private const MIN_WITHDRAWAL = 1000;

    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ══ Citizen ═══════════════════════════════════════════════════════════

    /** GET /referrals/payout — balance, saved account and any open request. */
    public function summary(): void {
        $auth   = requireRole('citizen');
        $userId = (int) $auth['userId'];

        $u = $this->userRow($userId);
        $b = $this->balance($userId, (int) $u['referral_count']);

        $pending = $this->db->prepare(
            'SELECT * FROM withdrawal_requests WHERE user_id = ? AND status = "pending" ORDER BY id DESC LIMIT 1'
        );
        $pending->execute([$userId]);
        $open = $pending->fetch();

        Response::json([
            'referralCount'   => (int) $u['referral_count'],
            'rewardRate'      => self::RATE,
            'totalEarned'     => $b['earned'],
            'totalPaid'       => $b['paid'],
            'pendingAmount'   => $b['pending'],
            'availableAmount' => $b['available'],
            'minWithdrawal'   => self::MIN_WITHDRAWAL,
            'payoutAccount'   => $u['bank_account_number'] ? [
                'bankName'      => $u['bank_name'],
                'accountNumber' => $u['bank_account_number'],
                'accountName'   => $u['bank_account_name'],
            ] : null,
            // Identity travels with the payout summary so the panel can show
            // the citizen what an admin will see before releasing their money.
            'identity'        => [
                'idType'        => $u['id_type'] ?? null,
                'idDocumentUrl' => $u['id_document_url'] ?? null,
            ],
            'openRequest'     => $open ? $this->format($open) : null,
        ]);
    }

    /** PUT /referrals/payout-account — save or update the destination account. */
    public function saveAccount(): void {
        $auth   = requireRole('citizen');
        $userId = (int) $auth['userId'];
        $body   = Validator::jsonBody() ?? [];

        $bank    = trim((string) ($body['bankName'] ?? ''));
        $number  = preg_replace('/\s+/', '', (string) ($body['accountNumber'] ?? ''));
        $name    = trim((string) ($body['accountName'] ?? ''));

        if ($bank === '' || $number === '' || $name === '') {
            Response::error('VALIDATION_ERROR', 'Bank name, account number and account name are all required.', 422);
        }
        // Nigerian bank accounts (NUBAN) are exactly ten digits.
        if (!preg_match('/^\d{10}$/', $number)) {
            Response::error('VALIDATION_ERROR', 'Account number must be exactly 10 digits.', 422);
        }

        $this->db->prepare('
            UPDATE users
               SET bank_name = ?, bank_account_number = ?, bank_account_name = ?, updated_at = NOW()
             WHERE id = ?
        ')->execute([$bank, $number, $name, $userId]);

        Response::json([
            'saved' => true,
            'payoutAccount' => ['bankName' => $bank, 'accountNumber' => $number, 'accountName' => $name],
        ]);
    }

    /** POST /referrals/withdrawals — request a payout. */
    public function request(): void {
        $auth   = requireRole('citizen');
        $userId = (int) $auth['userId'];
        $body   = Validator::jsonBody() ?? [];

        $u = $this->userRow($userId);

        if (!$u['bank_account_number']) {
            Response::error('NO_PAYOUT_ACCOUNT', 'Add your bank account details before requesting a withdrawal.', 422);
        }

        // Identification is required, not merely encouraged. Enforced here
        // rather than only in the panel: the UI can be bypassed by calling the
        // endpoint directly, and this is the gate that money passes through.
        if (empty($u['id_document_url'])) {
            Response::error(
                'NO_IDENTIFICATION',
                'Upload a means of identification before requesting a withdrawal.',
                422
            );
        }

        $openStmt = $this->db->prepare(
            'SELECT id FROM withdrawal_requests WHERE user_id = ? AND status = "pending" LIMIT 1'
        );
        $openStmt->execute([$userId]);
        if ($openStmt->fetch()) {
            Response::error('REQUEST_PENDING', 'You already have a withdrawal awaiting approval.', 409);
        }

        $b      = $this->balance($userId, (int) $u['referral_count']);
        $amount = (float) ($body['amount'] ?? $b['available']);

        if ($amount < self::MIN_WITHDRAWAL) {
            Response::error('AMOUNT_TOO_SMALL', 'The minimum withdrawal is NGN ' . number_format(self::MIN_WITHDRAWAL) . '.', 422);
        }
        if ($amount > $b['available']) {
            Response::error('INSUFFICIENT_BALANCE', 'That is more than your available balance of NGN ' . number_format($b['available'], 2) . '.', 422);
        }

        $this->db->prepare('
            INSERT INTO withdrawal_requests
                (user_id, amount, bank_name, account_number, account_name, status, requested_at)
            VALUES (?, ?, ?, ?, ?, "pending", NOW())
        ')->execute([
            $userId, $amount,
            $u['bank_name'], $u['bank_account_number'], $u['bank_account_name'],
        ]);

        $id = (int) $this->db->lastInsertId();

        NotificationService::send($this->db, $userId, [
            'category' => 'Official',
            'priority' => 'normal',
            'title'    => 'Withdrawal request received',
            'body'     => 'We received your request for NGN ' . number_format($amount, 2) . '. You will be notified once it is paid.',
            'linkTo'   => '/referrals',
        ]);

        Response::json(['requestId' => $id, 'status' => 'pending', 'amount' => $amount], 201);
    }

    /** GET /referrals/withdrawals — the citizen's own request history. */
    public function myRequests(): void {
        $auth = requireRole('citizen');
        $stmt = $this->db->prepare(
            'SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY id DESC LIMIT 50'
        );
        $stmt->execute([(int) $auth['userId']]);
        Response::json(array_map([$this, 'format'], $stmt->fetchAll()));
    }

    // ══ Admin ═════════════════════════════════════════════════════════════

    /** GET /admin/withdrawals?status=pending — the payout queue. */
    public function adminList(): void {
        $this->requireAdmin();

        $status = trim($_GET['status'] ?? 'pending');
        $where  = in_array($status, ['pending', 'paid', 'rejected'], true) ? 'w.status = ?' : '1=1';
        $params = $where === '1=1' ? [] : [$status];

        // Identity comes along too: an admin about to transfer real money
        // wants to see the ID the citizen uploaded, and whether the name on it
        // matches the account they are paying.
        $stmt = $this->db->prepare("
            SELECT w.*, u.name AS user_name, u.username, u.email AS user_email,
                   u.phone AS user_phone, u.lga_name, u.referral_count,
                   u.id_type, u.id_document_url, u.is_verified
              FROM withdrawal_requests w
              JOIN users u ON u.id = w.user_id
             WHERE {$where}
             ORDER BY w.requested_at ASC
             LIMIT 200
        ");
        $stmt->execute($params);

        $rows = array_map(function (array $r) {
            $out = $this->format($r);
            $out['user'] = [
                'id'            => (int) $r['user_id'],
                'name'          => $r['user_name'],
                'username'      => $r['username'],
                'email'         => $r['user_email'],
                'phone'         => $r['user_phone'],
                'lgaName'       => $r['lga_name'],
                'referralCount' => (int) $r['referral_count'],
                'isVerified'    => (bool) $r['is_verified'],
                'idType'        => $r['id_type'],
                'idDocumentUrl' => $r['id_document_url'],
            ];
            return $out;
        }, $stmt->fetchAll());

        $counts = $this->db->query('
            SELECT status, COUNT(*) c, COALESCE(SUM(amount),0) total
              FROM withdrawal_requests GROUP BY status
        ')->fetchAll();

        // Money out of the door is the figure an admin is actually accountable
        // for, so it is carried alongside the amount still owed rather than
        // being left to be worked out from the Paid tab by hand.
        $summary = [
            'pending'       => 0, 'paid'      => 0, 'rejected'      => 0,
            'pendingTotal'  => 0, 'paidTotal' => 0, 'rejectedTotal' => 0,
        ];

        foreach ($counts as $c) {
            $summary[$c['status']] = (int) $c['c'];
            $summary[$c['status'] . 'Total'] = (float) $c['total'];
        }

        // Paid this calendar month, so the headline total has something to be
        // read against — "₦450,000 all time" alone says nothing about pace.
        $summary['paidThisMonth'] = (float) $this->db->query('
            SELECT COALESCE(SUM(amount), 0)
              FROM withdrawal_requests
             WHERE status = "paid"
               AND processed_at >= DATE_FORMAT(NOW(), "%Y-%m-01")
        ')->fetchColumn();

        Response::json(['requests' => $rows, 'summary' => $summary]);
    }

    /**
     * POST /admin/withdrawals/:id/pay
     *
     * Records that the transfer has been made. This is the point at which the
     * citizen's balance drops for good and their confirmation email goes out.
     */
    public function markPaid(int $id): void {
        $admin = $this->requireAdmin();
        $body  = Validator::jsonBody() ?? [];

        $req = $this->requestRow($id);
        if ($req['status'] !== 'pending') {
            Response::error('ALREADY_PROCESSED', 'That request has already been ' . $req['status'] . '.', 409);
        }

        $reference = trim((string) ($body['paymentReference'] ?? '')) ?: null;
        $note      = trim((string) ($body['note'] ?? '')) ?: null;

        $this->db->prepare('
            UPDATE withdrawal_requests
               SET status = "paid", payment_reference = ?, admin_note = ?,
                   processed_at = NOW(), processed_by = ?
             WHERE id = ?
        ')->execute([$reference, $note, $admin['adminId'], $id]);

        $user = $this->userRow((int) $req['user_id']);

        EmailService::sendPayoutConfirmation(
            $user['email'],
            $user['name'] ?? $user['username'] ?? '',
            (float) $req['amount'],
            $req['bank_name'],
            $req['account_number'],
            $reference
        );

        NotificationService::send($this->db, (int) $req['user_id'], [
            'category' => 'Official',
            'priority' => 'high',
            'title'    => 'Your withdrawal has been paid',
            'body'     => 'NGN ' . number_format((float) $req['amount'], 2) . ' has been sent to your '
                        . $req['bank_name'] . ' account ending ' . substr($req['account_number'], -4) . '.',
            'linkTo'   => '/referrals',
        ]);

        Response::json(['status' => 'paid', 'requestId' => $id]);
    }

    /** POST /admin/withdrawals/:id/reject — releases the reserved balance. */
    public function reject(int $id): void {
        $admin = $this->requireAdmin();
        $body  = Validator::jsonBody() ?? [];

        $req = $this->requestRow($id);
        if ($req['status'] !== 'pending') {
            Response::error('ALREADY_PROCESSED', 'That request has already been ' . $req['status'] . '.', 409);
        }

        $reason = trim((string) ($body['reason'] ?? '')) ?: 'No reason given.';

        $this->db->prepare('
            UPDATE withdrawal_requests
               SET status = "rejected", admin_note = ?, processed_at = NOW(), processed_by = ?
             WHERE id = ?
        ')->execute([$reason, $admin['adminId'], $id]);

        NotificationService::send($this->db, (int) $req['user_id'], [
            'category' => 'Official',
            'priority' => 'high',
            'title'    => 'Withdrawal request declined',
            'body'     => $reason,
            'linkTo'   => '/referrals',
        ]);

        Response::json(['status' => 'rejected', 'requestId' => $id]);
    }

    // ══ Helpers ═══════════════════════════════════════════════════════════

    /**
     * Earned, minus anything already paid, minus anything currently reserved
     * by a pending request.
     */
    private function balance(int $userId, int $referralCount): array {
        $stmt = $this->db->prepare('
            SELECT
                COALESCE(SUM(CASE WHEN status = "paid"    THEN amount END), 0) AS paid,
                COALESCE(SUM(CASE WHEN status = "pending" THEN amount END), 0) AS pending
              FROM withdrawal_requests
             WHERE user_id = ?
        ');
        $stmt->execute([$userId]);
        $r = $stmt->fetch();

        $earned  = (float) ($referralCount * self::RATE);
        $paid    = (float) $r['paid'];
        $pending = (float) $r['pending'];

        return [
            'earned'    => $earned,
            'paid'      => $paid,
            'pending'   => $pending,
            'available' => max(0, $earned - $paid - $pending),
        ];
    }

    private function format(array $r): array {
        return [
            'id'               => (int) $r['id'],
            'amount'           => (float) $r['amount'],
            'bankName'         => $r['bank_name'],
            'accountNumber'    => $r['account_number'],
            'accountName'      => $r['account_name'],
            'status'           => $r['status'],
            'adminNote'        => $r['admin_note'],
            'paymentReference' => $r['payment_reference'],
            'requestedAt'      => $r['requested_at'],
            'processedAt'      => $r['processed_at'],
        ];
    }

    private function userRow(int $id): array {
        $stmt = $this->db->prepare('
            SELECT id, name, username, email, referral_count,
                   bank_name, bank_account_number, bank_account_name,
                   id_type, id_document_url
              FROM users WHERE id = ? LIMIT 1
        ');
        $stmt->execute([$id]);
        $u = $stmt->fetch();
        if (!$u) Response::error('NOT_FOUND', 'User not found.', 404);
        return $u;
    }

    private function requestRow(int $id): array {
        $stmt = $this->db->prepare('SELECT * FROM withdrawal_requests WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $r = $stmt->fetch();
        if (!$r) Response::error('NOT_FOUND', 'Withdrawal request not found.', 404);
        return $r;
    }

    private function requireAdmin(): array {
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? (function_exists('apache_request_headers')
                ? (apache_request_headers()['Authorization'] ?? '')
                : '');

        if (!$header || !str_starts_with($header, 'Bearer ')) {
            Response::error('UNAUTHENTICATED', 'Authorization token required.', 401);
        }

        try {
            $payload = JWT::decode(substr($header, 7), JWT_SECRET);
        } catch (RuntimeException) {
            Response::error('UNAUTHENTICATED', 'Invalid or expired token.', 401);
        }

        if (($payload['type'] ?? '') !== 'admin') {
            Response::error('FORBIDDEN', 'Admin access required.', 403);
        }
        if (!in_array($payload['role'] ?? '', ['admin', 'super_admin'], true)) {
            Response::error('FORBIDDEN', 'Insufficient privileges.', 403);
        }

        return ['adminId' => (int) ($payload['adminId'] ?? 0), 'role' => $payload['role']];
    }
}
