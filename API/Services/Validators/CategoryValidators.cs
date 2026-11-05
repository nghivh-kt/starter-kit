using API.Models.DTOs;
using FluentValidation;

namespace API.Services.Validators
{
    /// <summary>
    /// Validator cho CategoryCreateRequest. Được FluentValidationFilter tự động gọi trước khi vào Controller.
    /// Kiểm tra trùng tên nằm trong CategoryService (cần truy vấn DB, khi sửa còn phải loại trừ Id đang sửa).
    /// </summary>
    public class CategoryCreateRequestValidator : AbstractValidator<CategoryCreateRequest>
    {
        public CategoryCreateRequestValidator()
        {
            RuleFor(x => x.Name).Cascade(CascadeMode.Stop).MustBeValidCategoryName();
            RuleFor(x => x.Description).MustBeValidCategoryDescription();
        }
    }

    /// <summary>
    /// Validator cho CategoryUpdateRequest
    /// </summary>
    public class CategoryUpdateRequestValidator : AbstractValidator<CategoryUpdateRequest>
    {
        public CategoryUpdateRequestValidator()
        {
            RuleFor(x => x.Name).Cascade(CascadeMode.Stop).MustBeValidCategoryName();
            RuleFor(x => x.Description).MustBeValidCategoryDescription();
            RuleFor(x => x.RowVersion).NotEmpty().WithMessage("Thiếu phiên bản dữ liệu. Vui lòng tải lại trang rồi thử lại.");
        }
    }

    /// <summary>
    /// Quy tắc dùng chung cho Create và Update: sửa một chỗ, cả hai cùng đổi.
    /// Độ dài khớp với CategoryConfiguration (nvarchar(100) / nvarchar(500)).
    /// </summary>
    internal static class CategoryRuleExtensions
    {
        public static IRuleBuilderOptions<T, string> MustBeValidCategoryName<T>(this IRuleBuilder<T, string> ruleBuilder)
        {
            return ruleBuilder
                .NotEmpty().WithMessage("Tên danh mục là bắt buộc.")
                .MaximumLength(100).WithMessage("Tên danh mục không được vượt quá 100 ký tự.");
        }

        public static IRuleBuilderOptions<T, string?> MustBeValidCategoryDescription<T>(this IRuleBuilder<T, string?> ruleBuilder)
        {
            return ruleBuilder
                .MaximumLength(500).WithMessage("Mô tả không được vượt quá 500 ký tự.");
        }
    }
}
