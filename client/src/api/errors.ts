/** Error envelope returned by the backend: `{ error: { code, message, details }, requestId }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }

  get isAuth(): boolean {
    return this.status === 401;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** A short, user-facing Turkish message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.isNetwork) return 'İnternet bağlantısı yok gibi görünüyor.';
    switch (e.code) {
      case 'RATE_LIMITED':
        return 'Çok sık denediniz. Biraz bekleyip tekrar deneyin.';
      case 'UPSTREAM_UNAVAILABLE':
        return 'Veri kaynağına şu an ulaşılamıyor. Biraz sonra tekrar deneyin.';
      case 'INVALID_CREDENTIALS':
        return 'E-posta ya da şifre hatalı.';
      case 'EMAIL_TAKEN':
        return 'Bu e-posta ile zaten bir hesap var.';
      case 'CHAT_MUTED':
        return 'Bir süreliğine mesaj gönderemezsiniz.';
      case 'SLOW_MODE':
        return 'Yavaş mod açık. Birkaç saniye bekleyin.';
      case 'MESSAGE_REJECTED':
        return 'Mesajınız topluluk kurallarına uymadığı için gönderilmedi.';
      case 'ACCOUNT_BANNED':
        return 'Hesabınız sohbet kurallarını ihlal ettiği için kapatıldı.';
      case 'EMAIL_NOT_VERIFIED':
        return 'Devam etmek için e-posta adresinizi doğrulayın.';
      case 'REGISTRATION_REQUIRED':
        return 'Bu özellik için giriş yapmanız gerekir.';
      case 'DISPLAY_NAME_REQUIRED':
        return 'Sohbete katılmak için bir görünen ad belirleyin.';
      case 'DISPLAY_NAME_TAKEN':
        return 'Bu ad kullanılıyor, başka bir ad deneyin.';
      case 'INVALID_TOKEN':
        return 'Bağlantının süresi dolmuş ya da geçersiz.';
      case 'LOCATION_UNSUPPORTED':
        return 'Bu konum için vakit bilgisi bulunamadı.';
      case 'FEATURE_DISABLED':
        return 'Bu özellik şu an kullanılamıyor.';
      case 'VALIDATION_FAILED':
        return 'Girdiğiniz bilgileri kontrol edin.';
      default:
        if (e.status >= 500) return 'Sunucuda bir sorun oluştu. Biraz sonra tekrar deneyin.';
        return e.message;
    }
  }
  return 'Beklenmeyen bir hata oluştu.';
}
