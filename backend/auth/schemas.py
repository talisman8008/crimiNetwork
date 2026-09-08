from pydantic import BaseModel

class LoginRequest(BaseModel):
    badge_id: str
    password: str

class TokenResponse(BaseModel):
    token: str
    access_token: str
    token_type: str
    role: str
    name: str
    badge_id: str
