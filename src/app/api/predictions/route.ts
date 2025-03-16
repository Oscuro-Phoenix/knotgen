import { NextResponse } from "next/server";
import Replicate from "replicate";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });

    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          prompt: prompt,
          num_outputs: 1,
          num_inference_steps: 50,
          scheduler: "K_EULER",
          guidance_scale: 7.5,
          width: 1024,
          height: 1024,
        }
      }
    );
    console.log(output)
    // The output should now be the generated image URL
    if (Array.isArray(output) && output.length > 0) {
      return NextResponse.json({ imageUrl: output[0] });
    } else {
      return NextResponse.json({ error: "Unexpected output format" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error generating image:", error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
