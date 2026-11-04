using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API.Common.Exceptions
{
    /// <summary>
    /// Bắt mọi exception chưa được xử lý và trả về theo chuẩn Problem Details (RFC 9457, application/problem+json).
    /// Đăng ký: AddErrorHandling() (Startup/ApiConfiguration.cs) + app.UseExceptionHandler() (PipelineConfiguration.cs).
    /// instance, traceId và code mặc định được thêm chung trong CustomizeProblemDetails (ApiConfiguration.AddErrorHandling).
    ///
    /// Nguyên tắc: chỉ AppException (lỗi chủ động của ứng dụng) mới trả 4xx kèm message.
    /// Exception của .NET/thư viện (ArgumentException, KeyNotFoundException...) là bug → 500, ẩn message.
    /// </summary>
    public class GlobalExceptionHandler : IExceptionHandler
    {
        private const string ServerErrorDetail = "Đã xảy ra lỗi trong hệ thống. Vui lòng thử lại sau hoặc liên hệ quản trị viên.";
        private const string ConflictDetail = "Xung đột dữ liệu. Có thể do trùng lặp, ràng buộc dữ liệu hoặc bản ghi đã bị người khác thay đổi.";

        // Mã lỗi SQL Server được coi là xung đột dữ liệu (409): trùng unique index / unique constraint, vi phạm khoá ngoại.
        // Các lỗi SQL khác (deadlock, timeout, cắt chuỗi...) là lỗi hệ thống → 500.
        private static readonly HashSet<int> ConflictSqlErrorNumbers = [2601, 2627, 547];

        private readonly IProblemDetailsService _problemDetailsService;
        private readonly ILogger<GlobalExceptionHandler> _logger;
        private readonly IHostEnvironment _env;

        public GlobalExceptionHandler(IProblemDetailsService problemDetailsService, ILogger<GlobalExceptionHandler> logger, IHostEnvironment env)
        {
            _problemDetailsService = problemDetailsService;
            _logger = logger;
            _env = env;
        }

        public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
        {
            var request = httpContext.Request;

            // Client đã huỷ request (đóng tab, timeout phía client): không còn ai nhận response
            if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
            {
                _logger.LogInformation("Request {Method} {Path} was cancelled by client.", request.Method, request.Path);
                httpContext.Response.StatusCode = 499;
                return true;
            }

            var statusCode = exception switch
            {
                AppException appException => appException.StatusCode,
                FluentValidation.ValidationException => StatusCodes.Status400BadRequest,
                BadHttpRequestException badRequest => badRequest.StatusCode, // Kestrel: body quá lớn, request sai định dạng...
                _ when IsDataConflict(exception) => StatusCodes.Status409Conflict,
                _ => StatusCodes.Status500InternalServerError
            };

            var problemDetails = CreateProblemDetails(exception, statusCode);

            // Lỗi 5xx ở Development: kèm chi tiết exception (cả inner exception) để debug. Production tuyệt đối không lộ.
            if (_env.IsDevelopment() && statusCode >= StatusCodes.Status500InternalServerError)
            {
                problemDetails.Extensions["exception"] = new
                {
                    type = exception.GetType().FullName,
                    message = exception.Message,
                    details = exception.ToString()
                };
            }

            if (statusCode >= StatusCodes.Status500InternalServerError)
                _logger.LogError(exception, "Unhandled exception on {Method} {Path}", request.Method, request.Path);
            else if (statusCode == StatusCodes.Status409Conflict && exception is not AppException)
                _logger.LogWarning(exception, "Data conflict on {Method} {Path}", request.Method, request.Path);
            else
                _logger.LogInformation("{Method} {Path} -> {StatusCode}: {Detail}", request.Method, request.Path, statusCode, problemDetails.Detail);

            httpContext.Response.StatusCode = statusCode;

            var written = await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = httpContext,
                ProblemDetails = problemDetails,
                Exception = exception
            });

            // Client không nhận JSON (Accept khác): vẫn trả body Problem Details, tránh middleware ném lại exception
            if (!written)
            {
                await httpContext.Response.WriteAsJsonAsync(problemDetails, (System.Text.Json.JsonSerializerOptions?)null,
                    "application/problem+json", cancellationToken);
            }

            return true;
        }

        private static bool IsDataConflict(Exception exception) => exception switch
        {
            DbUpdateConcurrencyException => true,
            DbUpdateException { InnerException: SqlException sqlException } => ConflictSqlErrorNumbers.Contains(sqlException.Number),
            SqlException sqlException => ConflictSqlErrorNumbers.Contains(sqlException.Number), // Lệnh chạy qua Dapper: không có DbUpdateException bọc ngoài
            _ => false
        };

        private static ProblemDetails CreateProblemDetails(Exception exception, int statusCode)
        {
            // Lỗi validate ném từ Service (validator.ValidateAndThrowAsync): trả cùng khuôn với FluentValidationFilter
            if (exception is FluentValidation.ValidationException fluentException && fluentException.Errors.Any())
            {
                var errors = fluentException.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

                return new ValidationProblemDetails(errors) { Status = statusCode };
            }

            var problemDetails = new ProblemDetails
            {
                Status = statusCode,
                Detail = exception switch
                {
                    AppException or FluentValidation.ValidationException or BadHttpRequestException => exception.Message,
                    _ when statusCode == StatusCodes.Status409Conflict => ConflictDetail, // không lộ thông báo lỗi SQL
                    _ => ServerErrorDetail
                }
            };

            // Không gán code ở đây thì CustomizeProblemDetails (ApiConfiguration.AddErrorHandling) tự điền theo status
            if (exception is AppException appException)
            {
                problemDetails.Extensions["code"] = appException.Code;
            }

            return problemDetails;
        }
    }
}
