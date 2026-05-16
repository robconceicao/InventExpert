from fastapi import FastAPI, UploadFile, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from cleaner import process, image_to_pdf_bytes

app = FastAPI(title="FormCleaner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/clean")
async def clean_form(file: UploadFile = File(...)):
    contents = await file.read()
    arr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    
    if img is None:
        return Response(status_code=400, content="Invalid image format")
        
    # Processa a imagem usando o script do Claude
    cleaned, info = process(
        img,
        ink="auto",
        fix_perspective=True,
        enhance=True,
        whiten=True
    )
    
    # Gera o PDF
    pdf_bytes = image_to_pdf_bytes(cleaned, dpi=200)
    
    return Response(content=pdf_bytes, media_type="application/pdf")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
