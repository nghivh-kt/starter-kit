namespace API.Common.Security
{
    /// <summary>
    /// Danh sách role của hệ thống. Dùng hằng số thay vì chuỗi rời rạc để tránh gõ sai,
    /// ví dụ: [Authorize(Roles = Roles.Admin)]. Thêm role mới ở đây và trong All.
    /// </summary>
    public static class Roles
    {
        public const string Admin = "Admin";
        public const string User = "User";

        public static readonly string[] All = [Admin, User];
    }
}
