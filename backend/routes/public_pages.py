from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates
from pathlib import Path


router = APIRouter(tags=["public"])  # paths absolute

BASE_DIR = Path(__file__).resolve().parents[1]
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@router.get("/")
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/register-face")
async def register_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/absensi-fun-meter")
async def fun_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/attendance")
async def attendance_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/fun-meter")
async def fun_meter_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/admin/register-db", tags=["admin"])
async def register_db_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/admin/dashboard", tags=["admin"])
async def admin_dashboard_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/admin/users", tags=["admin"])
async def admin_users_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/admin/attendance", tags=["admin"])
async def admin_attendance_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/admin/schedule", tags=["admin"])
async def admin_schedule_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/admin/config", tags=["admin"])
async def admin_config_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

