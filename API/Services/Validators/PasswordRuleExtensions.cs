using FluentValidation;
using System.Text;

namespace API.Services.Validators
{
    /// <summary>
    /// Quy tắc mật khẩu dùng chung cho mọi validator (tạo user, đặt lại mật khẩu, v.v...).
    /// Nếu muốn thay đổi quy tắc mật khẩu, hãy sửa ở đây.
    /// Dùng: RuleFor(x => x.Password).Cascade(CascadeMode.Stop).MustBeValidPassword();
    /// </summary>
    public static class PasswordRuleExtensions
    {
        // 8 ký tự là mức tối thiểu NIST khuyến nghị; đổi MinLength nếu cần khớp quy định nội bộ.
        public const int MinLength = 8;

        // bcrypt chỉ dùng 72 BYTE đầu của mật khẩu, phần sau bị bỏ qua âm thầm.
        // Đếm theo byte UTF-8, không theo ký tự: chữ có dấu tiếng Việt chiếm 2-3 byte
        // (72 ký tự có dấu có thể dài hơn 72 byte). Giới hạn trên cũng chặn việc băm chuỗi quá dài.
        public const int MaxBytes = 72;

        public static IRuleBuilderOptions<T, string> MustBeValidPassword<T>(this IRuleBuilder<T, string> ruleBuilder)
        {
            return ruleBuilder
                .NotEmpty().WithMessage("Mật khẩu là bắt buộc.")
                .MinimumLength(MinLength).WithMessage($"Mật khẩu phải có ít nhất {MinLength} ký tự.")
                .Must(password => password is null || Encoding.UTF8.GetByteCount(password) <= MaxBytes)
                .WithMessage($"Mật khẩu quá dài (tối đa {MaxBytes} byte; mỗi chữ có dấu chiếm 2-3 byte).");
        }
    }
}
