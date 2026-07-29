<?php

class Validator {
    /**
     * Validate required fields are present and non-empty.
     * Returns an error message string or null if valid.
     */
    public static function required(array $data, array $fields): ?string {
        foreach ($fields as $field) {
            $value = $data[$field] ?? null;
            if ($value === null || $value === '') {
                return "Field '{$field}' is required.";
            }
        }
        return null;
    }

    /**
     * Validate minimum string length.
     */
    public static function minLength(string $value, int $min, string $fieldName = 'field'): ?string {
        if (mb_strlen($value) < $min) {
            return ucfirst($fieldName) . " must be at least {$min} characters.";
        }
        return null;
    }

    /**
     * Normalise a Nigerian phone number to E.164 format.
     * Accepts: 0801..., +234801..., 234801...
     * Returns null if it can't be normalised.
     */
    public static function normalisePhone(?string $phone): ?string {
        if (!$phone) return null;
        $p = trim($phone);
        // Remove spaces, dashes, parentheses
        $p = preg_replace('/[\s\-\(\)]/', '', $p);

        if (str_starts_with($p, '0') && strlen($p) === 11) {
            return '+234' . substr($p, 1);
        }
        if (str_starts_with($p, '+234') && strlen($p) === 14) {
            return $p;
        }
        if (str_starts_with($p, '234') && strlen($p) === 13) {
            return '+' . $p;
        }
        return null;
    }

    /**
     * Basic email validation.
     */
    public static function isEmail(string $value): bool {
        return (bool) filter_var($value, FILTER_VALIDATE_EMAIL);
    }

    /**
     * Parse and validate JSON body from php://input.
     * Returns decoded array or null.
     */
    public static function jsonBody(): ?array {
        $raw = file_get_contents('php://input');
        if (!$raw) return [];
        $data = json_decode($raw, true);
        return is_array($data) ? $data : null;
    }
}
