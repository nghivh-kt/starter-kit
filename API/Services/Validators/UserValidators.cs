using API.Common.Security;
using API.Models.DTOs;
using FluentValidation;

namespace API.Services.Validators
{
    /// <summary>
    /// Validator cho UserCreateRequest: chỉ kiểm tra định dạng dữ liệu, không truy vấn DB.
    /// Kiểm tra trùng username/email nằm trong UserService.CreateAsync (tính cả user đã xoá mềm).
    /// </summary>
    public class UserCreateRequestValidator : AbstractValidator<UserCreateRequest>
    {
        public UserCreateRequestValidator()
        {
            RuleFor(x => x.UserName)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Tên đăng nhập là bắt buộc.")
                .Matches(@"^[a-zA-Z0-9._-]{3,50}$").WithMessage("Tên đăng nhập gồm 3-50 ký tự: chữ không dấu, số, '.', '_' hoặc '-'.");

            RuleFor(x => x.FullName)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Họ và tên là bắt buộc.")
                .MaximumLength(100).WithMessage("Họ và tên không được vượt quá 100 ký tự.");

            // Quy tắc mật khẩu (độ dài tối thiểu, giới hạn 72 byte của bcrypt)
            RuleFor(x => x.Password)
                .Cascade(CascadeMode.Stop)
                .MustBeValidPassword();

            RuleFor(x => x.Email)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Email là bắt buộc.")
                .MaximumLength(256).WithMessage("Email không được vượt quá 256 ký tự.")
                .EmailAddress().WithMessage("Email phải là một địa chỉ email hợp lệ.");

            RuleFor(x => x.Role)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Role là bắt buộc.")
                .Must(role => Roles.All.Contains(role))
                .WithMessage($"Role phải là một trong: {string.Join(", ", Roles.All)}.");
        }
    }

    /// <summary>
    /// Validator cho UserUpdateRequest
    /// </summary>
    public class UserUpdateRequestValidator : AbstractValidator<UserUpdateRequest>
    {
        public UserUpdateRequestValidator()
        {
            RuleFor(x => x.FullName)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Họ và tên là bắt buộc.")
                .MaximumLength(100).WithMessage("Họ và tên không được vượt quá 100 ký tự.");

            RuleFor(x => x.Role)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Role là bắt buộc.")
                .Must(role => Roles.All.Contains(role))
                .WithMessage($"Role phải là một trong: {string.Join(", ", Roles.All)}.");

            RuleFor(x => x.RowVersion).NotEmpty().WithMessage("Thiếu phiên bản dữ liệu. Vui lòng tải lại trang rồi thử lại.");
        }
    }

    /// <summary>
    /// Validator cho UserResetPasswordRequest
    /// </summary>
    public class UserResetPasswordRequestValidator : AbstractValidator<UserResetPasswordRequest>
    {
        public UserResetPasswordRequestValidator()
        {
            RuleFor(x => x.NewPassword)
                .Cascade(CascadeMode.Stop)
                .MustBeValidPassword();
        }
    }
}
