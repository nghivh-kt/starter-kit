using API.Data.Interfaces;
using API.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.ComponentModel.DataAnnotations;

namespace API.Services.Background
{
    /// <summary>Cấu hình "Cleanup" trong appsettings.json: dọn dữ liệu không còn dùng.</summary>
    public class CleanupSettings
    {
        /// <summary>
        /// Giữ refresh token thêm bao nhiêu ngày sau khi hết hạn (để tra lịch sử đăng nhập) rồi mới xoá.
        /// </summary>
        [Range(1, 365)]
        public int RefreshTokenRetentionDays { get; set; } = 30;
    }

    /// <summary>
    /// Xoá refresh token đã hết hạn quá RefreshTokenRetentionDays ngày. Mỗi lần refresh sinh một dòng mới, nên không dọn thì bảng
    /// tăng mãi. Xoá token đã hết hạn không ảnh hưởng phát hiện dùng lại token: refresh kiểm tra hạn trước, token hết hạn bị từ chối ngay.
    /// </summary>
    public class RefreshTokenCleanup(IUnitOfWork unitOfWork, IOptions<CleanupSettings> options, TimeProvider timeProvider)
    {
        /// <returns>Số token đã xoá</returns>
        public Task<int> RunAsync(CancellationToken ct)
        {
            var cutoff = timeProvider.GetUtcNow().UtcDateTime.AddDays(-options.Value.RefreshTokenRetentionDays);

            // ExecuteDelete: một lệnh DELETE, không nạp từng dòng lên bộ nhớ
            return unitOfWork.Repository<RefreshToken>().Query(asNoTracking: false)
                .Where(token => token.ExpiresAt < cutoff)
                .ExecuteDeleteAsync(ct);
        }
    }

    /// <summary>
    /// Chạy RefreshTokenCleanup một phút sau khi app khởi động, sau đó mỗi 24 giờ.
    /// SQL Server Express không có SQL Agent để đặt lịch, nên việc dọn nằm trong app. IIS tắt app khi lâu không có request
    /// thì lần khởi động sau sẽ dọn tiếp. Nhiều instance cùng chạy cũng không sao: xoá lặp lại chỉ không còn gì để xoá.
    /// </summary>
    public sealed class RefreshTokenCleanupService(
        IServiceScopeFactory scopeFactory, TimeProvider timeProvider, ILogger<RefreshTokenCleanupService> logger) : BackgroundService
    {
        private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(1);
        private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                // Không tranh tài nguyên với lúc app vừa khởi động
                await Task.Delay(StartupDelay, timeProvider, stoppingToken);

                using var timer = new PeriodicTimer(Interval, timeProvider);
                do
                {
                    await RunOnceAsync(stoppingToken);
                }
                while (await timer.WaitForNextTickAsync(stoppingToken));
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // App đang dừng
            }
        }

        private async Task RunOnceAsync(CancellationToken ct)
        {
            // Exception thoát khỏi BackgroundService sẽ làm dừng cả app: lỗi (database chưa sẵn sàng...) chỉ ghi log, lần sau chạy lại
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var deleted = await scope.ServiceProvider.GetRequiredService<RefreshTokenCleanup>().RunAsync(ct);
                if (deleted > 0)
                    logger.LogInformation("Đã xoá {Count} refresh token hết hạn.", deleted);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Không dọn được refresh token hết hạn, sẽ thử lại ở lần chạy sau.");
            }
        }
    }
}
