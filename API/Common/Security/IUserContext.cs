namespace API.Common.Security
{
    public interface IUserContext
    {
        int? UserId { get; }
        string? UserName { get; }
        string IpAddress { get; }
    }
}
