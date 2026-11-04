using API.Models.DTOs;
using API.Models.Entities;
using Mapster;

namespace API.Common.Mappings
{
    /// <summary>
    /// Cấu hình Mapster. Mapster tự map các property trùng tên, nên chỉ cần khai báo
    /// những trường hợp đặc biệt (đổi tên, bỏ qua field, tính toán giá trị...).
    /// Mọi class IRegister trong assembly được nạp tự động trong Startup/ApplicationServicesConfiguration.cs.
    /// </summary>
    public class MappingConfig : IRegister
    {
        public void Register(TypeAdapterConfig config)
        {
            // User: không bao giờ map PasswordHash từ request (được hash riêng trong UserService)
            config.NewConfig<UserCreateRequest, User>()
                .Ignore(dest => dest.PasswordHash);

            // CategoryCreateRequest -> Category: tên property trùng nhau, Mapster tự map, không cần khai báo.
            // CategoryUpdateRequest gán tay trong CategoryService (IsActive null = giữ nguyên, Mapster sẽ đổi null thành false)
        }
    }
}
