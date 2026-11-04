using API.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace API.Data.Configurations
{
    public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
    {
        public void Configure(EntityTypeBuilder<RefreshToken> builder)
        {
            // SHA256 dạng Base64 dài 44 ký tự
            builder.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
            builder.Property(x => x.CreatedByIp).HasMaxLength(45);
            builder.Property(x => x.RevokedByIp).HasMaxLength(45);
            builder.Property(x => x.ReasonRevoked).HasMaxLength(200);

            // Tra cứu token khi refresh/logout
            builder.HasIndex(x => x.TokenHash).IsUnique();
            // Thu hồi toàn bộ token của 1 user (khoá tài khoản, đặt lại mật khẩu, logout-all)
            builder.HasIndex(x => x.UserId);

            // Xoá user thì xoá luôn token của user đó
            builder.HasOne<User>()
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
