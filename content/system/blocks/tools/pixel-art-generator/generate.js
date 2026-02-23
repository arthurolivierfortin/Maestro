#!/usr/bin/env node
/**
 * Pixel Art Generator — calls LLM-Provider image generation API.
 * Reads inputs from MAESTRO_INPUT_* environment variables.
 * Outputs JSON to stdout (parsed by ToolBlockExecutor with parseOutput: "json").
 */

const LLM_PROVIDER_URL = process.env.LLM_PROVIDER_URL || 'http://localhost:5010';

// Fixed prompt prefix for consistent pixel art style
const PROMPT_PREFIX = 'low-res pixel art, 2-color monochrome, chunky pixels, retro handheld sprite, crisp edges, no antialiasing, ';
const NEGATIVE_PROMPT = 'smooth, blurry, gradient, 3D, realistic, antialiased, photorealistic, high resolution, detailed, soft shadows';

async function main() {
  const prompt = process.env.MAESTRO_INPUT_PROMPT;
  if (!prompt) {
    console.log(JSON.stringify({ success: false, error: 'Missing required input: prompt' }));
    return;
  }

  const width = parseInt(process.env.MAESTRO_INPUT_WIDTH || '24', 10);
  const height = parseInt(process.env.MAESTRO_INPUT_HEIGHT || '22', 10);
  const palette = parseInt(process.env.MAESTRO_INPUT_PALETTE || '2', 10);
  const style = process.env.MAESTRO_INPUT_STYLE || 'maestro-v1';
  const seed = parseInt(process.env.MAESTRO_INPUT_SEED || '-1', 10);
  const steps = parseInt(process.env.MAESTRO_INPUT_STEPS || '30', 10);

  const body = {
    prompt: PROMPT_PREFIX + prompt,
    negative_prompt: NEGATIVE_PROMPT,
    width: 512,
    height: 512,
    steps: steps,
    cfg_scale: 12.0,
    seed: seed,
    lora: style,
    lora_weight: 0.8,
    post_process: {
      target_width: width,
      target_height: height,
      palette_size: palette,
      cleanup: true,
      output_format: 'bitmap',
    },
  };

  try {
    const res = await fetch(`${LLM_PROVIDER_URL}/api/v1/image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(110000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.log(JSON.stringify({ success: false, error: `API error ${res.status}: ${err}` }));
      return;
    }

    const data = await res.json();
    console.log(JSON.stringify({
      success: true,
      bitmap: data.bitmap || [],
      seed: data.seed,
      width: data.width || width,
      height: data.height || height,
    }));
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: e.message }));
  }
}

main();
