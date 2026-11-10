namespace API.Common.Exceptions
{
    /// <summary>
    /// Lỗi chủ động của ứng dụng: Message là thông báo dành cho người dùng, được trả nguyên văn trong "detail".
    /// GlobalExceptionHandler trả về Problem Details với StatusCode và Code của từng class.
    /// Mọi exception KHÔNG kế thừa AppException đều bị coi là lỗi hệ thống (500, ẩn message).
    /// </summary>
    public abstract class AppException(string message) : Exception(message)
    {
        public abstract int StatusCode { get; }
        public abstract string Code { get; }
    }

    /// <summary>Vi phạm quy tắc nghiệp vụ (trùng dữ liệu, trạng thái không hợp lệ...) → 400</summary>
    public class BusinessException(string message) : AppException(message)
    {
        public override int StatusCode => StatusCodes.Status400BadRequest;
        public override string Code => ErrorCodes.BusinessError;
    }

    /// <summary>Chưa xác thực hoặc thông tin xác thực không hợp lệ (sai mật khẩu, token hết hạn...) → 401</summary>
    public class UnauthorizedException(string message) : AppException(message)
    {
        public override int StatusCode => StatusCodes.Status401Unauthorized;
        public override string Code => ErrorCodes.Unauthorized;
    }

    /// <summary>Đã xác thực nhưng không được phép (tài khoản bị khoá, thiếu quyền...) → 403</summary>
    public class ForbiddenException(string message) : AppException(message)
    {
        public override int StatusCode => StatusCodes.Status403Forbidden;
        public override string Code => ErrorCodes.Forbidden;
    }

    /// <summary>Không tìm thấy tài nguyên được yêu cầu → 404</summary>
    public class NotFoundException(string message) : AppException(message)
    {
        public override int StatusCode => StatusCodes.Status404NotFound;
        public override string Code => ErrorCodes.NotFound;
    }

    /// <summary>Tài khoản đang bị khoá tạm do nhập sai mật khẩu nhiều lần → 429</summary>
    public class AccountLockedException(string message) : AppException(message)
    {
        public override int StatusCode => StatusCodes.Status429TooManyRequests;
        public override string Code => ErrorCodes.AccountLocked;
    }

    /// <summary>Xung đột với trạng thái hiện tại của tài nguyên → 409</summary>
    public class ConflictException(string message) : AppException(message)
    {
        public override int StatusCode => StatusCodes.Status409Conflict;
        public override string Code => ErrorCodes.Conflict;
    }
}
