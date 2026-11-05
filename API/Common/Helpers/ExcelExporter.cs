using API.Common.Exceptions;
using ClosedXML.Excel;
using Microsoft.Extensions.Options;
using System.ComponentModel.DataAnnotations;

namespace API.Common.Helpers
{
    /// <summary>Cấu hình "Export" trong appsettings.json.</summary>
    public class ExportSettings
    {
        /// <summary>Số dòng tối đa của một file: toàn bộ file được tạo trong bộ nhớ nên phải có giới hạn.</summary>
        [Range(1, 1_000_000)]
        public int MaxRows { get; set; } = 50_000;

        /// <summary>Múi giờ hiển thị trong file. Database lưu UTC, còn file Excel chỉ chứa giờ đã đổi.</summary>
        [Required]
        public string TimeZone { get; set; } = "Asia/Ho_Chi_Minh";
    }

    /// <summary>Một cột trong file: tiêu đề và cách lấy giá trị từ một dòng.</summary>
    public sealed record ExcelColumn<T>(string Header, Func<T, object?> Value);

    /// <summary>Tạo file .xlsx. Giá trị chuỗi luôn được ghi dạng chữ: nội dung như "=1+1" không trở thành công thức.</summary>
    public interface IExcelExporter
    {
        /// <summary>Báo lỗi nghiệp vụ nếu số dòng vượt giới hạn. Gọi trước khi tải dữ liệu từ database.</summary>
        void EnsureWithinLimit(int rowCount);

        byte[] Create<T>(string sheetName, IReadOnlyList<ExcelColumn<T>> columns, IReadOnlyCollection<T> rows);
    }

    public sealed class ExcelExporter(IOptions<ExportSettings> options) : IExcelExporter
    {
        public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        private const string DateFormat = "dd/MM/yyyy HH:mm";
        // Đo độ rộng từng ô rất chậm: chỉ đo các dòng đầu là đủ chính xác
        private const int RowsToMeasureForWidth = 500;

        private readonly ExportSettings _settings = options.Value;
        private readonly TimeZoneInfo _timeZone = TimeZoneInfo.FindSystemTimeZoneById(options.Value.TimeZone);

        public void EnsureWithinLimit(int rowCount)
        {
            if (rowCount > _settings.MaxRows)
            {
                throw new BusinessException(
                    $"Có {rowCount:N0} dòng, vượt giới hạn {_settings.MaxRows:N0} dòng của một file. Vui lòng lọc bớt dữ liệu rồi xuất lại.");
            }
        }

        public byte[] Create<T>(string sheetName, IReadOnlyList<ExcelColumn<T>> columns, IReadOnlyCollection<T> rows)
        {
            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add(sheetName);

            for (var column = 0; column < columns.Count; column++)
            {
                var header = sheet.Cell(1, column + 1);
                header.Value = columns[column].Header;
                header.Style.Font.Bold = true;
            }
            sheet.SheetView.FreezeRows(1);

            var rowNumber = 2;
            foreach (var row in rows)
            {
                for (var column = 0; column < columns.Count; column++)
                {
                    WriteCell(sheet.Cell(rowNumber, column + 1), columns[column].Value(row));
                }
                rowNumber++;
            }

            sheet.Columns().AdjustToContents(1, Math.Min(rowNumber - 1, RowsToMeasureForWidth));

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        private void WriteCell(IXLCell cell, object? value)
        {
            switch (value)
            {
                case null:
                    break;
                case DateTime date:
                    cell.Value = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(date, DateTimeKind.Utc), _timeZone);
                    cell.Style.DateFormat.Format = DateFormat;
                    break;
                case int number:
                    cell.Value = number;
                    break;
                case decimal number:
                    cell.Value = number;
                    break;
                default:
                    cell.Value = value.ToString();
                    break;
            }
        }
    }
}
