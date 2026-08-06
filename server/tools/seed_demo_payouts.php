<?php

/**
 * seed_demo_payouts.php — throwaway payout requests for eyeballing the UI.
 *
 * Creates three citizens and three withdrawal requests, one in each state
 * (pending / paid / rejected), so the Referral Payouts screen can be seen
 * fully populated without waiting for real people to ask for money.
 *
 *     php server/tools/seed_demo_payouts.php seed
 *     php server/tools/seed_demo_payouts.php status
 *     php server/tools/seed_demo_payouts.php remove
 *
 * Safety, because this is capable of running against a live database:
 *
 *   - Every row it creates is tagged. Users get the username prefix
 *     `zzdemo_` and an @demo.invalid address (a reserved TLD, so nothing can
 *     ever be delivered to it); requests get [DEMO] in admin_note.
 *   - remove deletes only rows carrying those markers, matched by id from the
 *     demo users it created. It cannot touch a real request.
 *   - It writes rows directly rather than calling the API, so no payout email
 *     or notification is sent to anybody.
 *   - seed refuses to run twice, and prints a before/after count of real rows
 *     so it is provable that none were touched.
 *
 * It is still demo money in a live table: while it is seeded, "Total paid out"
 * includes ₦12,500 that was never paid. Seed, look, remove.
 */

$root = dirname(__DIR__);
require_once $root . '/config/env.php';
require_once $root . '/config/database.php';

const DEMO_USER_PREFIX = 'zzdemo_';
const DEMO_EMAIL_HOST  = 'demo.invalid';
const DEMO_TAG         = '[DEMO]';

$db  = Database::connect();
$cmd = $argv[1] ?? 'status';

/** Real rows are everything not belonging to a demo user. */
function realCounts(PDO $db): array {
    $ids = demoUserIds($db);
    $not = $ids ? 'user_id NOT IN (' . implode(',', $ids) . ')' : '1=1';

    return [
        'users'    => (int) $db->query(
            "SELECT COUNT(*) FROM users WHERE username NOT LIKE '" . DEMO_USER_PREFIX . "%'"
        )->fetchColumn(),
        'requests' => (int) $db->query("SELECT COUNT(*) FROM withdrawal_requests WHERE {$not}")->fetchColumn(),
        'paidSum'  => (float) $db->query(
            "SELECT COALESCE(SUM(amount),0) FROM withdrawal_requests WHERE status='paid' AND {$not}"
        )->fetchColumn(),
    ];
}

function demoUserIds(PDO $db): array {
    return array_map('intval', $db->query(
        "SELECT id FROM users WHERE username LIKE '" . DEMO_USER_PREFIX . "%'"
    )->fetchAll(PDO::FETCH_COLUMN));
}

function show(PDO $db, string $label): array {
    $c = realCounts($db);
    printf("%-14s real users %d | real requests %d | real paid total NGN %s\n",
        $label, $c['users'], $c['requests'], number_format($c['paidSum'], 2));
    return $c;
}

// ── status ────────────────────────────────────────────────────────────────

if ($cmd === 'status') {
    $ids = demoUserIds($db);
    echo 'demo users: ' . (count($ids) ?: 'none') . ($ids ? ' (' . implode(',', $ids) . ')' : '') . "\n";

    if ($ids) {
        $rows = $db->query(
            'SELECT id, user_id, amount, status, admin_note FROM withdrawal_requests
              WHERE user_id IN (' . implode(',', $ids) . ') ORDER BY id'
        )->fetchAll();
        foreach ($rows as $r) {
            printf("  req %-5d user %-6d NGN %-12s %-9s %s\n",
                $r['id'], $r['user_id'], number_format((float) $r['amount'], 2), $r['status'], $r['admin_note']);
        }
    }
    show($db, 'baseline:');
    exit;
}

// ── remove ────────────────────────────────────────────────────────────────

if ($cmd === 'remove') {
    $before = show($db, 'before:');
    $ids    = demoUserIds($db);

    if (!$ids) { echo "nothing to remove\n"; exit; }

    $in = implode(',', $ids);
    $db->beginTransaction();

    $reqs  = $db->exec("DELETE FROM withdrawal_requests WHERE user_id IN ({$in})");
    $notes = $db->exec("DELETE FROM notifications WHERE user_id IN ({$in})");
    $users = $db->exec("DELETE FROM users WHERE id IN ({$in})");

    $db->commit();

    echo "removed {$users} demo users, {$reqs} demo requests, {$notes} notifications\n";
    $after = show($db, 'after:');

    $same = $before == $after;
    echo $same ? "OK — real data identical before and after\n"
               : "WARNING — real counts changed, investigate\n";
    exit;
}

// ── seed ──────────────────────────────────────────────────────────────────

if ($cmd !== 'seed') {
    fwrite(STDERR, "usage: seed_demo_payouts.php [seed|status|remove]\n");
    exit(1);
}

if (demoUserIds($db)) {
    fwrite(STDERR, "demo data is already seeded — run 'remove' first\n");
    exit(1);
}

$before = show($db, 'before:');

// Every state the queue can show, with amounts that look plausible without
// being round enough to be mistaken for a real request.
$people = [
    [
        'name' => 'Demo — Awaiting Payment', 'user' => 'awaiting',
        'bank' => 'Guaranty Trust Bank', 'acct' => '0122334455', 'acctName' => 'DEMO AWAITING PAYMENT',
        'referrals' => 34, 'amount' => 8500.00, 'status' => 'pending',
        'requested' => '-2 days', 'processed' => null,
        'note' => DEMO_TAG . ' Sample request — do not pay.', 'ref' => null,
    ],
    [
        'name' => 'Demo — Already Paid', 'user' => 'paid',
        'bank' => 'Access Bank', 'acct' => '0988776655', 'acctName' => 'DEMO ALREADY PAID',
        'referrals' => 50, 'amount' => 12500.00, 'status' => 'paid',
        // Processed inside the current calendar month, so the "this month"
        // figure on the header has something in it to look at.
        'requested' => '-9 days', 'processed' => '-3 days',
        'note' => DEMO_TAG . ' Sample paid payout.', 'ref' => 'DEMO-TRF-004918',
    ],
    [
        'name' => 'Demo — Declined', 'user' => 'declined',
        'bank' => 'Zenith Bank', 'acct' => '0455667788', 'acctName' => 'DEMO DECLINED REQUEST',
        'referrals' => 12, 'amount' => 3000.00, 'status' => 'rejected',
        'requested' => '-5 days', 'processed' => '-4 days',
        'note' => DEMO_TAG . ' Name on the ID does not match the account name.', 'ref' => null,
    ],
];

$lga = $db->query('SELECT id, name FROM lgas ORDER BY id LIMIT 1')->fetch() ?: ['id' => null, 'name' => null];

// Unusable by design: the demo accounts must not be loggable-into.
$lockedPassword = password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT);

$db->beginTransaction();

$insertUser = $db->prepare('
    INSERT INTO users (name, username, email, password, referral_code, referral_count,
                       lga_id, lga_name, region, state, status, is_verified,
                       bank_name, bank_account_number, bank_account_name,
                       id_type, id_document_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, "west", "Lagos", "suspended", 0, ?, ?, ?, "NIN", ?, NOW(), NOW())
');

$insertReq = $db->prepare('
    INSERT INTO withdrawal_requests (user_id, amount, bank_name, account_number, account_name,
                                     status, admin_note, payment_reference, requested_at, processed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), ?)
');

foreach ($people as $p) {
    $username = DEMO_USER_PREFIX . $p['user'];

    $insertUser->execute([
        $p['name'], $username, $username . '@' . DEMO_EMAIL_HOST, $lockedPassword,
        strtoupper('DEMO' . substr(md5($username), 0, 6)), $p['referrals'],
        $lga['id'], $lga['name'],
        $p['bank'], $p['acct'], $p['acctName'],
        // A placeholder rather than a real document: an admin clicking "View
        // ID" should get an obvious dead link, not somebody's actual NIN.
        'https://example.invalid/demo-id-placeholder.png',
    ]);

    $userId = (int) $db->lastInsertId();

    $insertReq->execute([
        $userId, $p['amount'], $p['bank'], $p['acct'], $p['acctName'],
        $p['status'], $p['note'], $p['ref'],
        (int) $p['requested'],
        $p['processed'] === null ? null : date('Y-m-d H:i:s', strtotime($p['processed'])),
    ]);

    printf("  seeded %-9s user %-6d NGN %s\n", $p['status'], $userId, number_format($p['amount'], 2));
}

$db->commit();

$after = show($db, 'after:');
echo ($before == $after)
    ? "OK — no real rows touched\n"
    : "WARNING — real counts changed, investigate\n";
echo "\nWhen you are done looking: php server/tools/seed_demo_payouts.php remove\n";
