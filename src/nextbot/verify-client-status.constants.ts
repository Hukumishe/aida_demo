/** Машиночитаемый результат verify_client_status — для ветвления Nextbot без галлюцинаций. */
export enum VerifyClientVerificationStatus {
  NOT_FOUND = 'NOT_FOUND',
  FOUND_WITH_BIRTH_DATE = 'FOUND_WITH_BIRTH_DATE',
  FOUND_WITHOUT_BIRTH_DATE = 'FOUND_WITHOUT_BIRTH_DATE',
}

/**
 * Ключи строк в таблице `prompts` (портал): для каждого статуса — свой текст.
 * В HTTP-ответе текст всё равно отдаётся в поле `verify_client_status`.
 */
export const VERIFY_CLIENT_STATUS_PROMPT_KEYS = {
  [VerifyClientVerificationStatus.NOT_FOUND]: 'verify_client_status_not_found',
  [VerifyClientVerificationStatus.FOUND_WITH_BIRTH_DATE]:
    'verify_client_status_found_with_birth_date',
  [VerifyClientVerificationStatus.FOUND_WITHOUT_BIRTH_DATE]:
    'verify_client_status_found_without_birth_date',
} as const;
