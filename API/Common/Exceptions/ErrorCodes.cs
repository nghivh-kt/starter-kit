namespace API.Common.Exceptions
{
    /// <summary>
    /// Mã lỗi máy đọc được, trả trong trường "code" của mọi Problem Details.
    /// Client phân nhánh theo code (không so chuỗi message), message chỉ để hiển thị.
    /// </summary>
    public static class ErrorCodes
    {
        public const string ValidationError = "VALIDATION_ERROR";
        public const string BusinessError = "BUSINESS_ERROR";
        public const string BadRequest = "BAD_REQUEST";
        public const string Unauthorized = "UNAUTHORIZED";
        public const string Forbidden = "FORBIDDEN";
        public const string NotFound = "NOT_FOUND";
        public const string Conflict = "CONFLICT";
        public const string TooManyRequests = "TOO_MANY_REQUESTS";
        public const string AccountLocked = "ACCOUNT_LOCKED";
        public const string InternalError = "INTERNAL_ERROR";

        /// <summary>Mã lỗi mặc định theo status, dùng khi nơi tạo Problem Details chưa gán code</summary>
        public static string FromStatus(int? statusCode, bool isValidation) => statusCode switch
        {
            _ when isValidation => ValidationError,
            StatusCodes.Status401Unauthorized => Unauthorized,
            StatusCodes.Status403Forbidden => Forbidden,
            StatusCodes.Status404NotFound => NotFound,
            StatusCodes.Status409Conflict => Conflict,
            StatusCodes.Status429TooManyRequests => TooManyRequests,
            >= StatusCodes.Status500InternalServerError => InternalError,
            _ => BadRequest
        };
    }
}
