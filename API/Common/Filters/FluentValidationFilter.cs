using FluentValidation;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace API.Common.Filters
{
    public class FluentValidationFilter : IAsyncActionFilter
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ProblemDetailsFactory _problemDetailsFactory;

        public FluentValidationFilter(IServiceProvider serviceProvider, ProblemDetailsFactory problemDetailsFactory)
        {
            _serviceProvider = serviceProvider;
            _problemDetailsFactory = problemDetailsFactory;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            foreach(var argument in context.ActionArguments.Values)
            {
                if (argument == null) continue;

                // Tìm IValidator<kiểu của tham số>; tham số không có validator (id, CancellationToken...) bị bỏ qua
                var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
                var validator = _serviceProvider.GetService(validatorType) as IValidator;

                if (validator != null)
                {
                    var validationResult = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
                    
                    foreach(var error in validationResult.Errors)
                    {
                        context.ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
                    }
                }
            }

            // Nếu có lỗi validate, gán kết quả trả về 400 và return luôn (chặn không cho vào Controller)
            if (!context.ModelState.IsValid)
            {
                var problemDetails = _problemDetailsFactory.CreateValidationProblemDetails(context.HttpContext, context.ModelState);
                context.Result = new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(problemDetails);
                return;
            }

            // Cho phép request đi tiếp vào Controller Action nếu dữ liệu sạch sẽ
            await next();
        }
    }
}
