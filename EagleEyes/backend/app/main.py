from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title = "EagleEyes API",
    description = "Backend API for the UNT EagleEyes Parking System",
    version = "1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins instead of "*"
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

@app.get("/")
def read_root():
    return {"message": "EagleEyes Backend is running and ready for development phase!"}

@app.get("/api/v1/health")
def health_check():
    return {"database": "disconnected", "parkzen_sdk": "pending"}