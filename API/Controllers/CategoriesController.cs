using API.Common.Helpers;
using API.Common.Security;
using API.Models.DTOs;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Mime;

namespace API.Controllers
{
    /// <summary>
    /// Controller mẫu: mọi user đăng nhập được xem, chỉ Admin được thêm/sửa/xoá.
    /// Validate request do FluentValidationFilter xử lý; lỗi nghiệp vụ do GlobalExceptionHandler trả về (Problem Details).
    /// ProducesResponseType là nguồn sinh kiểu TypeScript cho Client: đổi response thì chạy lại "npm run api:gen".
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
        [ProducesResponseType<PagedResult<CategoryResponse>>(StatusCodes.Status200OK)]
        public async Task<ActionResult<PagedResult<CategoryResponse>>> GetPaged([FromQuery] CategoryQueryRequest query, CancellationToken ct)
        {
            return Ok(await _categoryService.GetPagedAsync(query, ct));
        }

        [HttpGet("{id:int}")]
        [ProducesResponseType<CategoryResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, MediaTypeNames.Application.ProblemJson)]
        public async Task<ActionResult<CategoryResponse>> GetById(int id, CancellationToken ct)
        {
            return Ok(await _categoryService.GetByIdAsync(id, ct));
        }

        [Authorize(Roles = Roles.Admin)]
        [HttpPost]
        [ProducesResponseType<CategoryResponse>(StatusCodes.Status201Created)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, MediaTypeNames.Application.ProblemJson)]
        public async Task<ActionResult<CategoryResponse>> Create([FromBody] CategoryCreateRequest request, CancellationToken ct)
        {
            var created = await _categoryService.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        [Authorize(Roles = Roles.Admin)]
        [HttpPut("{id:int}")]
        [ProducesResponseType<CategoryResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, MediaTypeNames.Application.ProblemJson)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, MediaTypeNames.Application.ProblemJson)]
        public async Task<ActionResult<CategoryResponse>> Update(int id, [FromBody] CategoryUpdateRequest request, CancellationToken ct)
        {
            return Ok(await _categoryService.UpdateAsync(id, request, ct));
        }

        [Authorize(Roles = Roles.Admin)]
        [HttpDelete("{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, MediaTypeNames.Application.ProblemJson)]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            await _categoryService.DeleteAsync(id, ct);
            return NoContent();
        }
    }
}
