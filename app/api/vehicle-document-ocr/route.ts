import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    
    // Return fallback flag if not configured
    if (!apiKey) {
      return NextResponse.json({ fallback: true, message: 'GOOGLE_VISION_API_KEY is not configured.' });
    }

    const body = await request.json();
    const { images } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    // Google Cloud Vision API URL
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    // Prepare batch request payload
    const requests = images.map((base64Str: string) => ({
      image: {
        content: base64Str.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '')
      },
      features: [
        {
          type: 'DOCUMENT_TEXT_DETECTION'
        }
      ]
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Vision API error:', errorText);
      return NextResponse.json({ fallback: true, error: 'Google Vision API request failed' });
    }

    const data = await response.json();
    
    // Parse results
    const results = data.responses.map((res: { textAnnotations?: { description: string }[] }) => {
      if (!res.textAnnotations || res.textAnnotations.length === 0) {
        return { fullText: '', lines: [] };
      }
      
      const fullText = res.textAnnotations[0].description;
      const lines = fullText.split('\n').map((l: string) => l.trim()).filter(Boolean);
      
      return { fullText, lines };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('OCR Route Exception:', error);
    return NextResponse.json({ fallback: true, error: 'Internal server error in OCR route' });
  }
}
