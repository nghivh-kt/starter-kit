using API.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace API.Data.Configurations
{
    public class UserConfiguration : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> builder)
        {
            builder.Property(x => x.UserName).HasMaxLength(50).IsRequired();
            builder.Property(x => x.FullName).HasMaxLength(100).IsRequired();
            builder.Property(x => x.Email).HasMaxLength(256).IsRequired();
            builder.Property(x => x.PasswordHash).HasMaxLength(100).IsRequired();
            builder.Property(x => x.Role).HasMaxLength(20).IsRequired();

            builder.HasIndex(x => x.UserName).IsUnique();
            builder.HasIndex(x => x.Email).IsUnique();

            // Không seed tài khoản ở đây: migration chạy cả trên production nên mật khẩu sẽ dùng chung mọi nơi.
            // Tài khoản quản trị đầu tiên do AdminSeedConfiguration tạo, mật khẩu lấy từ cấu hình "Seed:AdminPassword".
        }
    }
}
