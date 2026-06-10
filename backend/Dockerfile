FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY backend ./backend

EXPOSE 5005

CMD ["gunicorn", "--bind", "0.0.0.0:5005", "--workers", "1", "--threads", "4", "backend.app:app"]
