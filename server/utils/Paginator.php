<?php

class Paginator {
    /**
     * Build LIMIT/OFFSET values from page + perPage.
     * Returns ['limit' => int, 'offset' => int, 'page' => int, 'perPage' => int]
     */
    public static function params(array $query, int $defaultPerPage = 20): array {
        $page    = max(1, (int) ($query['page']    ?? 1));
        $perPage = max(1, (int) ($query['perPage'] ?? $defaultPerPage));

        return [
            'page'    => $page,
            'perPage' => $perPage,
            'limit'   => $perPage,
            'offset'  => ($page - 1) * $perPage,
        ];
    }
}
