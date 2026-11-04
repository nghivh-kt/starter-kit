using API.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace API.Data.Configurations
{
    public class CategoryConfiguration : IEntityTypeConfiguration<Category>
    {
        public void Configure(EntityTypeBuilder<Category> builder)
        {
            // Tên danh mục là duy nhất trong số các bản ghi chưa bị xoá mềm
            builder.HasIndex(x => x.Name)
                .IsUnique()
                .HasFilter("[DeletedAt] IS NULL");
        }
    }
}
