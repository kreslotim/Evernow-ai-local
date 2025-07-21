export enum QueueNames {
  PHOTO_ANALYSIS = 'photo-analysis',
  NOTIFICATION = 'notification',
  CLEANUP = 'cleanup',
}

export enum JobTypes {
  ANALYZE_PHOTO = 'analyze-photo',
  SEND_RESULT = 'send-result',
  CLEANUP_TEMP_FILES = 'cleanup-temp-files',
}
