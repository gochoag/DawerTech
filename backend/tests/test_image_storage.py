import io

import pytest
from PIL import Image

from dawertech.shared.domain.exceptions import ApiProblem
from dawertech.shared.infrastructure.local_storage import LocalStorageService


def photo(size=(1600, 1200), mode='RGB', color='orange', exif=None):
    output = io.BytesIO()
    with Image.new(mode, size, color) as image:
        image.save(output, 'PNG' if mode == 'RGBA' else 'JPEG', **({'exif': exif} if exif else {}))
    return output.getvalue()


def test_photos_are_bounded_webp_and_metadata_free(tmp_path):
    storage = LocalStorageService(tmp_path)
    filename = storage.save_image(photo())
    result = tmp_path / filename
    assert result.stat().st_size <= 250 * 1024
    with Image.open(result) as image:
        assert image.format == 'WEBP'
        assert max(image.size) <= 1200
        assert not image.getexif()


def test_complex_image_obeys_the_storage_budget(tmp_path):
    output = io.BytesIO()
    with Image.effect_noise((1800, 1600), 100).convert('RGB') as image:
        image.save(output, 'PNG')
    storage = LocalStorageService(tmp_path)
    filename = storage.save_image(output.getvalue())
    assert (tmp_path / filename).stat().st_size <= 250 * 1024


def test_orientation_is_applied_before_metadata_is_removed(tmp_path):
    exif = Image.Exif()
    exif[274] = 6
    storage = LocalStorageService(tmp_path)
    filename = storage.save_image(photo(size=(40, 20), exif=exif))
    with Image.open(tmp_path / filename) as image:
        assert image.size == (20, 40)
        assert not image.getexif()


def test_transparency_is_preserved(tmp_path):
    filename = LocalStorageService(tmp_path).save_image(photo(mode='RGBA', color=(255, 0, 0, 0)))
    with Image.open(tmp_path / filename) as image:
        assert image.getpixel((0, 0))[3] == 0


def test_quota_includes_the_incoming_file_and_leaves_no_partial_file(tmp_path):
    storage = LocalStorageService(tmp_path, max_quota_bytes=0)
    with pytest.raises(ApiProblem) as problem:
        storage.save_image(photo())
    assert problem.value.status == 507
    assert list(tmp_path.iterdir()) == []


def test_quota_counts_existing_non_webp_files(tmp_path):
    (tmp_path / 'old.png').write_bytes(b'12345')
    storage = LocalStorageService(tmp_path, max_quota_bytes=6)
    with pytest.raises(ApiProblem):
        storage.check_quota(2)
    storage.check_quota(1)


def test_invalid_or_oversized_dimensions_are_rejected(tmp_path):
    storage = LocalStorageService(tmp_path)
    with pytest.raises(ApiProblem):
        storage.save_image(b'not an image')
    with pytest.raises(ApiProblem):
        storage.save_image(photo(size=(4000, 3100)))
    assert list(tmp_path.iterdir()) == []


def test_storage_cannot_read_or_delete_a_parent_file(tmp_path):
    outside = tmp_path / 'outside.webp'
    outside.write_bytes(b'keep')
    storage = LocalStorageService(tmp_path / 'media')
    assert storage.get_image_path('../outside.webp') is None
    storage.delete_image('../outside.webp')
    assert outside.read_bytes() == b'keep'
