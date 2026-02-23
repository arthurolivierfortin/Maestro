# Pixel Art Generator

Generate pixel art sprites using Stable Diffusion with post-processing to bitmap format.

## Usage

Call this tool with the following inputs:

- **prompt** (required): What to generate. Be descriptive and specific.
  - Good: "conductor face, round glasses, bald head, walrus mustache, front view"
  - Bad: "a person"
- **width**: Target width in pixels (default: 24, max: 64)
- **height**: Target height in pixels (default: 22, max: 64)
- **palette**: Number of colors — 2 (outline/background) or 3 (outline/fill/background)
- **style**: LoRA style name. Use "maestro-v1" for consistent Maestro visual identity.
- **seed**: Random seed. Use -1 for random. Save the seed from output to reproduce or create variations.
- **steps**: Inference steps (default: 30). Higher = better quality but slower.

## Output Format

- `bitmap`: Array of strings where `#` = primary (foreground), `+` = secondary (fill), `.` = background
- `seed`: The seed used — save this for reproducibility
- `width`, `height`: Actual output dimensions
- `success`: Whether generation succeeded

## Tips for Good Results

1. **Be specific**: "robot face, dome head, antenna, rectangular visor eyes, front view" works better than "robot"
2. **Specify view**: Always include "front view", "side view", or "3/4 view" for characters
3. **For animation frames**: Use the same seed but vary the prompt slightly for each frame
4. **For sprite sheets**: Use sequential seeds (42, 43, 44...) for visual consistency across poses
5. **Standard sizes**: 24x22 for character sprites, 32x32 for icons, 16x16 for small sprites
6. **3-color mode**: Use palette=3 when you need more detail (body shading, depth)
7. **Iterate**: If the first result isn't good, try different seeds or rephrase the prompt
