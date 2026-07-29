<?php

class Response {
    public static function json($data, int $status = 200, array $meta = []): void {
        http_response_code($status);
        $payload = ['data' => $data];
        if (!empty($meta)) {
            $payload['meta'] = $meta;
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $code, string $message, int $status = 400, array $extra = []): void {
        http_response_code($status);
        $error = ['code' => $code, 'message' => $message];
        if (!empty($extra)) {
            $error = array_merge($error, $extra);
        }
        echo json_encode(['error' => $error], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function paginated(array $items, int $page, int $perPage, int $total): void {
        $totalPages = $perPage > 0 ? (int) ceil($total / $perPage) : 1;
        self::json($items, 200, [
            'page'       => $page,
            'perPage'    => $perPage,
            'total'      => $total,
            'totalPages' => $totalPages,
        ]);
    }
}
