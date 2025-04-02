import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: Request) {
  try {
    const { answers } = await req.json();

    // Format the prompt for LLaMA
    const prompt = `Create a professional blue-collar resume using the following information in a structured format:
${JSON.stringify(answers, null, 2)}

Format the resume with the following sections in this exact structure:
{
  "personalInfo": {
    "name": "",
    "email": "",
    "phone": "",
    "address": ""
  },
  "professionalSummary": "",
  "workExperience": [
    {
      "title": "",
      "company": "",
      "location": "",
      "dates": "",
      "responsibilities": [],
      "achievements": []
    }
  ],
  "certifications": [],
  "technicalSkills": [],
  "safetyTraining": [],
  "education": {
    "degree": "",
    "school": "",
    "location": "",
    "graduationYear": ""
  }
}

Ensure the response is in valid JSON format. Focus on practical skills, certifications, and hands-on experience.`;

    // Call Replicate's LLaMA model
    const output = await replicate.run(
      "meta/llama-2-70b-chat:02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3",
      {
        input: {
          prompt,
          max_new_tokens: 2000,
          temperature: 0.5,
          top_p: 0.9,
          system_prompt: "You are a professional resume writer specializing in blue-collar and trade professions. Create structured, JSON-formatted resumes that emphasize practical skills, certifications, and hands-on experience."
        }
      }
    );

    // Parse the JSON response
    const resumeContent = Array.isArray(output) ? output.join('') : output;
    
    // Clean up the response to extract only the JSON part
    let cleanedContent = String(resumeContent); // Convert to string explicitly
    // Find the first '{' and last '}' to extract just the JSON portion
    const startIndex = cleanedContent.indexOf('{');
    const endIndex = cleanedContent.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1) {
      cleanedContent = cleanedContent.slice(startIndex, endIndex + 1);
    }

    // Now parse the cleaned JSON
    const resumeData = JSON.parse(cleanedContent);

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Format and add content to PDF with proper sections and styling
    let yPosition = page.getHeight() - 50;
    const margin = 50;
    const fontSize = 12;

    // Add formatted content section by section
    // Personal Info
    page.setFont(boldFont);
    page.drawText(resumeData.personalInfo.name, {
      x: margin,
      y: yPosition,
      size: fontSize + 4
    });
    
    yPosition -= 20;
    page.setFont(font);
    page.drawText(`${resumeData.personalInfo.email} | ${resumeData.personalInfo.phone}`, {
      x: margin,
      y: yPosition,
      size: fontSize
    });

    // Professional Summary
    yPosition -= 40;
    page.setFont(boldFont);
    page.drawText('Professional Summary', {
      x: margin,    
      y: yPosition,
      size: fontSize
    });
    
    yPosition -= 20;
    page.setFont(font);
    const summaryLines = splitTextIntoLines(resumeData.professionalSummary, 80);
    for (const line of summaryLines) {
      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: fontSize
      });
      yPosition -= 15;
    }

    // Work Experience
    yPosition -= 20;
    page.setFont(boldFont);
    page.drawText('Work Experience', {
      x: margin,
      y: yPosition,
      size: fontSize
    });

    for (const job of resumeData.workExperience) {
      yPosition -= 20;
      page.setFont(boldFont);
      page.drawText(`${job.title} - ${job.company}`, {
        x: margin,
        y: yPosition,
        size: fontSize
      });

      yPosition -= 15;
      page.setFont(font);
      page.drawText(`${job.location} | ${job.dates}`, {
        x: margin,
        y: yPosition,
        size: fontSize
      });

      yPosition -= 15;
      for (const responsibility of job.responsibilities) {
        page.drawText(`• ${responsibility}`, {
          x: margin + 10,
          y: yPosition,
          size: fontSize
        });
        yPosition -= 15;
      }

      if (job.achievements.length > 0) {
        for (const achievement of job.achievements) {
          page.drawText(`• ${achievement}`, {
            x: margin + 10,
            y: yPosition,
            size: fontSize
          });
          yPosition -= 15;
        }
      }
      yPosition -= 10;
    }

    // Certifications
    if (resumeData.certifications.length > 0) {
      yPosition -= 20;
      page.setFont(boldFont);
      page.drawText('Certifications', {
        x: margin,
        y: yPosition,
        size: fontSize
      });

      yPosition -= 20;
      page.setFont(font);
      for (const cert of resumeData.certifications) {
        page.drawText(`• ${cert}`, {
          x: margin + 10,
          y: yPosition,
          size: fontSize
        });
        yPosition -= 15;
      }
    }

    // Technical Skills
    if (resumeData.technicalSkills.length > 0) {
      yPosition -= 20;
      page.setFont(boldFont);
      page.drawText('Technical Skills', {
        x: margin,
        y: yPosition,
        size: fontSize
      });

      yPosition -= 20;
      page.setFont(font);
      for (const skill of resumeData.technicalSkills) {
        page.drawText(`• ${skill}`, {
          x: margin + 10,
          y: yPosition,
          size: fontSize
        });
        yPosition -= 15;
      }
    }

    // Safety Training
    if (resumeData.safetyTraining.length > 0) {
      yPosition -= 20;
      page.setFont(boldFont);
      page.drawText('Safety Training', {
        x: margin,
        y: yPosition,
        size: fontSize
      });

      yPosition -= 20;
      page.setFont(font);
      for (const training of resumeData.safetyTraining) {
        page.drawText(`• ${training}`, {
          x: margin + 10,
          y: yPosition,
          size: fontSize
        });
        yPosition -= 15;
      }
    }

    // Education
    yPosition -= 20;
    page.setFont(boldFont);
    page.drawText('Education', {
      x: margin,
      y: yPosition,
      size: fontSize
    });

    yPosition -= 20;
    page.setFont(boldFont);
    page.drawText(`${resumeData.education.degree}`, {
      x: margin,
      y: yPosition,
      size: fontSize
    });

    yPosition -= 15;
    page.setFont(font);
    page.drawText(`${resumeData.education.school} - ${resumeData.education.location}`, {
      x: margin,
      y: yPosition,
      size: fontSize
    });

    yPosition -= 15;
    page.drawText(`Graduated: ${resumeData.education.graduationYear}`, {
      x: margin,
      y: yPosition,
      size: fontSize
    });

    // Helper function to split long text into lines
    function splitTextIntoLines(text: string, maxCharsPerLine: number): string[] {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      return lines;
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Return PDF with proper headers
    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="resume.pdf"',
      },
    });
  } catch (error) {
    console.error('Resume generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate resume' },
      { status: 500 }
    );
  }
} 