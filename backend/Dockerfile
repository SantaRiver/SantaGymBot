FROM python:3.12-slim

WORKDIR /app

# Install poetry
RUN pip install --no-cache-dir poetry

# Copy dependencies
COPY pyproject.toml poetry.lock* ./

# Install dependencies without virtualenv since we are in docker
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root

# Copy application code
COPY . .

# Run uvicorn on port 8000
CMD ["uvicorn", "app.main_api:app", "--host", "0.0.0.0", "--port", "8000"]
