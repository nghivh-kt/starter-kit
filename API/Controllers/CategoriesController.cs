using API.Common.Security;
using API.Models.DTOs;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    /// <summary>
    /// Controller mẫu: mọi user đăng nhập được xem, chỉ Admin được thêm/sửa/xoá.
    /// Validate request do FluentValidationFilter xử lý; lỗi nghiệp vụ do GlobalExceptionHandler trả về (Problem Details).
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class CategoriesController : ControllerBase
    {
        private readonly ICategoryService _categoryService;

        public CategoriesController(ICategoryService categoryService)
        {
            _categoryService = categoryService;
        }

        [HttpGet]
        public async Task<IActionResult> GetPaged([FromQuery] CategoryQueryRequest query, CancellationToken ct)
        {
            return Ok(await _categoryService.GetPagedAsync(query, ct));
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id, CancellationToken ct)
        {
            return Ok(await _categoryService.GetByIdAsync(id, ct));
        }

        [Authorize(Roles = Roles.Admin)]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CategoryCreateRequest request, CancellationToken ct)
        {
            var created = await _categoryService.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        [Authorize(Roles = Roles.Admin)]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] CategoryUpdateRequest request, CancellationToken ct)
        {
            return Ok(await _categoryService.UpdateAsync(id, request, ct));
        }

        [Authorize(Roles = Roles.Admin)]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            await _categoryService.DeleteAsync(id, ct);
            return NoContent();
        }
    }
}
