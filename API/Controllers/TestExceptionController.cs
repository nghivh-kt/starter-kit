#if DEBUG

using API.Common.Exceptions;
using API.Data;
using API.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    /// <summary>
    /// Chỉ có trong bản build DEBUG: cố ý ném các loại exception để kiểm tra GlobalExceptionHandler
    /// (gọi thử qua Swagger: /api/testexception/...)
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous] // Cho phép truy cập mà không cần xác thực
    public class TestExceptionController : ControllerBase
    {
        // ---------------- Lỗi chủ động của ứng dụng (AppException) -> 4xx kèm message ----------------

        [HttpGet("business")]
        public IActionResult ThrowBusiness() => throw new BusinessException("Vi phạm quy tắc nghiệp vụ.");

        [HttpGet("forbidden")]
        public IActionResult ThrowForbidden() => throw new ForbiddenException("Bạn không có quyền truy cập tài nguyên này.");

        [HttpGet("not-found")]
        public IActionResult ThrowNotFound() => throw new NotFoundException("Không tìm thấy dữ liệu!");

        [HttpGet("fluent-validation")]
        public IActionResult ThrowFluentValidation()
        {
            // Giả lập service gọi validator.ValidateAndThrowAsync(...)
            throw new FluentValidation.ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("Name", "Tên là bắt buộc."),
                new FluentValidation.Results.ValidationFailure("Name", "Tên tối đa 100 ký tự."),
                new FluentValidation.Results.ValidationFailure("Email", "Email không hợp lệ.")
            });
        }

        // ---------------- Exception của .NET / thư viện (bug) -> 500, ẩn message ----------------

        [HttpGet("null-reference")]
        public IActionResult ThrowNullReference()
        {
            string? value = null;
            var length = value!.Length; // cố ý gây NullReferenceException
            return Ok(length);
        }

        [HttpGet("key-not-found")]
        public IActionResult ThrowKeyNotFound() => throw new KeyNotFoundException("The given key 'secret-config' was not present in the dictionary.");

        [HttpGet("argument")]
        public IActionResult ThrowArgument() => throw new ArgumentNullException("connectionString");

        [HttpGet("unauthorized-access")]
        public IActionResult ThrowUnauthorizedAccess() => throw new UnauthorizedAccessException(@"Access to the path 'C:\inetpub\app\secrets.json' is denied.");

        // ---------------- Lỗi database thật ----------------

        /// <summary>Hai danh mục trùng tên trong cùng 1 lần lưu -> vi phạm unique index (SQL 2601) -> 409</summary>
        [HttpPost("db-unique")]
        public async Task<IActionResult> ThrowDbUnique([FromServices] EFDbContext db, CancellationToken ct)
        {
            var name = $"dup-{Guid.NewGuid():N}";
            db.Categories.AddRange(new Category { Name = name, IsActive = true }, new Category { Name = name, IsActive = true });
            await db.SaveChangesAsync(ct);
            return Ok();
        }

        /// <summary>Tên dài quá nvarchar(100) -> lỗi cắt chuỗi (SQL 2628), không phải xung đột -> 500</summary>
        [HttpPost("db-error")]
        public async Task<IActionResult> ThrowDbError([FromServices] EFDbContext db, CancellationToken ct)
        {
            db.Categories.Add(new Category { Name = new string('x', 300), IsActive = true });
            await db.SaveChangesAsync(ct);
            return Ok();
        }
    }
}

#endif
