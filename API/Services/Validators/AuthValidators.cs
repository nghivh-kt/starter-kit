using API.Models.DTOs;
using FluentValidation;

namespace API.Services.Validators
{
    /// <summary>
    /// Validator cho LoginRequest. Chỉ kiểm tra có nhập và chặn chuỗi quá dài;
    /// đúng/sai tài khoản do AuthService kiểm tra (không tiết lộ username có tồn tại hay không).
    /// </summary>
    public class LoginRequestValidator : AbstractValidator<LoginRequest>
    {
        private const int MaxInputLength = 256;

        public LoginRequestValidator()
        {
            RuleFor(x => x.UserName)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Tên đăng nhập là bắt buộc.")
                .MaximumLength(MaxInputLength).WithMessage($"Tên đăng nhập không được vượt quá {MaxInputLength} ký tự.");

            RuleFor(x => x.Password)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Mật khẩu là bắt buộc.")
                .MaximumLength(MaxInputLength).WithMessage($"Mật khẩu không được vượt quá {MaxInputLength} ký tự.");
        }
    }

    /// <summary>
    /// Validator cho ChangePasswordRequest
    /// </summary>
    public class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
    {
        public ChangePasswordRequestValidator()
        {
            RuleFor(x => x.CurrentPassword)
                .NotEmpty().WithMessage("Mật khẩu hiện tại là bắt buộc.");

            RuleFor(x => x.NewPassword)
                .Cascade(CascadeMode.Stop)
                .MustBeValidPassword()
                .NotEqual(x => x.CurrentPassword).WithMessage("Mật khẩu mới phải khác mật khẩu hiện tại.");
        }
    }
}
