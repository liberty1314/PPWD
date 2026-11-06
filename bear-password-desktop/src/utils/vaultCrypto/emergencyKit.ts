export interface EmergencyKitPayload {
  version: 2
  recoveryKey: string
  secretKeyFingerprint: string
  createdAt: string
}

export function buildEmergencyKitFileName(): string {
  return 'BearPassword-Emergency-Kit.txt'
}

export function buildEmergencyKitFileContent(payload: EmergencyKitPayload): string {
  return [
    'BearPassword Emergency Kit',
    '================================',
    '',
    '请妥善保管此文件。恢复密钥与主密码共同保护您的保险库。',
    '丢失此文件且无其他备份时，将无法恢复手机令牌绑定。',
    '',
    `创建时间: ${payload.createdAt}`,
    `密钥指纹: ${payload.secretKeyFingerprint}`,
    '',
    '恢复密钥 (Recovery Key):',
    payload.recoveryKey,
    '',
    '--------------------------------',
    'BearPassword - 请勿与他人分享此文件'
  ].join('\n')
}
