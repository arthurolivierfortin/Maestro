"""
PixelQuantizer: Post-processing pipeline for converting SD-generated images
into crisp pixel art bitmaps compatible with Maestro's renderBitmap().

Pipeline:
  1. Resize to target dimensions using NEAREST neighbor (no interpolation)
  2. Convert to grayscale
  3. Quantize to 2-3 colors using adaptive thresholds
  4. Optional morphological cleanup (remove isolated pixels)
  5. Export as bitmap string array ('#' / '+' / '.')

No GPU needed — pure PIL/numpy operations.
"""
from typing import List, Dict, Any, Optional

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False


# Character mapping for bitmap export
CHAR_2COLOR = {0: '.', 1: '#'}
CHAR_3COLOR = {0: '.', 1: '+', 2: '#'}


class PixelQuantizer:
    """Converts images into crisp pixel art bitmaps."""

    @staticmethod
    def process(
        image,  # PIL.Image
        target_width: int = 32,
        target_height: int = 32,
        palette_size: int = 2,
        cleanup: bool = True,
        threshold_method: str = "otsu",
    ) -> Dict[str, Any]:
        """
        Full post-processing pipeline.

        Args:
            image: PIL.Image to process
            target_width: Output bitmap width in pixels
            target_height: Output bitmap height in pixels
            palette_size: Number of colors (2 or 3)
            cleanup: Remove isolated pixels (noise reduction)
            threshold_method: "otsu", "global", or "percentile"

        Returns:
            dict with: bitmap (string[]), width, height, palette_size
        """
        if not PIL_AVAILABLE:
            raise RuntimeError("Pillow not installed. Run: pip install Pillow")
        if not NUMPY_AVAILABLE:
            raise RuntimeError("numpy not installed. Run: pip install numpy")

        # 1. Resize with NEAREST neighbor (critical for pixel art — no interpolation)
        resized = image.resize((target_width, target_height), Image.NEAREST)

        # 2. Convert to grayscale
        gray = resized.convert('L')
        arr = np.array(gray, dtype=np.float64)

        # 3. Quantize to palette
        if palette_size == 2:
            bitmap = PixelQuantizer._quantize_2color(arr, threshold_method)
        elif palette_size == 3:
            bitmap = PixelQuantizer._quantize_3color(arr, threshold_method)
        else:
            raise ValueError(f"palette_size must be 2 or 3, got {palette_size}")

        # 4. Cleanup isolated pixels
        if cleanup:
            bitmap = PixelQuantizer._cleanup_isolated(bitmap)

        # 5. Export to string array
        char_map = CHAR_3COLOR if palette_size == 3 else CHAR_2COLOR
        rows = []
        for y in range(target_height):
            row = ''.join(char_map.get(int(bitmap[y, x]), '.') for x in range(target_width))
            rows.append(row)

        return {
            "bitmap": rows,
            "width": target_width,
            "height": target_height,
            "palette_size": palette_size,
        }

    @staticmethod
    def _quantize_2color(arr, method: str = "otsu"):
        """Binary quantization: '#' (foreground) and '.' (background)."""
        threshold = PixelQuantizer._compute_threshold(arr, method)
        # Dark pixels = foreground (#), light pixels = background (.)
        # Use <= so that pixels AT the threshold are included as foreground
        return (arr <= threshold).astype(np.int32)

    @staticmethod
    def _quantize_3color(arr, method: str = "otsu"):
        """Three-level quantization: '#' (primary), '+' (secondary), '.' (background)."""
        if method == "percentile":
            t1 = np.percentile(arr, 33)
            t2 = np.percentile(arr, 66)
        else:
            # Use 1/3 and 2/3 of the Otsu/global threshold range
            threshold = PixelQuantizer._compute_threshold(arr, method)
            t1 = threshold * 0.6
            t2 = threshold * 1.4

        result = np.zeros_like(arr, dtype=np.int32)
        result[arr <= t1] = 2   # Darkest = '#' (primary)
        result[(arr > t1) & (arr <= t2)] = 1  # Mid = '+' (secondary)
        # Lightest stays 0 = '.' (background)
        return result

    @staticmethod
    def _compute_threshold(arr, method: str) -> float:
        """Compute binarization threshold."""
        if method == "otsu":
            return PixelQuantizer._otsu_threshold(arr)
        elif method == "global":
            return float(np.mean(arr))
        elif method == "percentile":
            return float(np.percentile(arr, 50))
        else:
            return float(np.mean(arr))

    @staticmethod
    def _otsu_threshold(arr) -> float:
        """Otsu's method for optimal threshold."""
        flat = arr.flatten().astype(np.int32)
        histogram = np.bincount(flat, minlength=256)
        total = flat.size

        if total == 0:
            return 128.0

        sum_total = float(np.sum(np.arange(256) * histogram))
        sum_bg = 0.0
        weight_bg = 0
        max_variance = 0.0
        threshold = 0.0

        for t in range(256):
            weight_bg += histogram[t]
            if weight_bg == 0:
                continue

            weight_fg = total - weight_bg
            if weight_fg == 0:
                break

            sum_bg += t * histogram[t]
            mean_bg = sum_bg / weight_bg
            mean_fg = (sum_total - sum_bg) / weight_fg

            variance = weight_bg * weight_fg * (mean_bg - mean_fg) ** 2

            if variance > max_variance:
                max_variance = variance
                threshold = float(t)

        return threshold

    @staticmethod
    def _cleanup_isolated(bitmap) -> 'np.ndarray':
        """Remove pixels with no same-value neighbors (noise reduction)."""
        height, width = bitmap.shape
        cleaned = bitmap.copy()

        for y in range(height):
            for x in range(width):
                val = bitmap[y, x]
                if val == 0:
                    continue  # Don't cleanup background

                # Count same-value neighbors (4-connected)
                neighbors = 0
                if y > 0 and bitmap[y - 1, x] == val:
                    neighbors += 1
                if y < height - 1 and bitmap[y + 1, x] == val:
                    neighbors += 1
                if x > 0 and bitmap[y, x - 1] == val:
                    neighbors += 1
                if x < width - 1 and bitmap[y, x + 1] == val:
                    neighbors += 1

                # Remove pixel if completely isolated (no same-value neighbors)
                if neighbors == 0:
                    cleaned[y, x] = 0

        return cleaned
