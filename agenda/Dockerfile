# Ponte de agendamento da Clínica Dias com o Feegow (Python puro, sem dependências)
FROM python:3.12-slim
WORKDIR /app
COPY servidor.py .
ENV HOST=0.0.0.0 PORT=3000 PYTHONUNBUFFERED=1
EXPOSE 3000
RUN useradd --system --no-create-home agenda
USER agenda
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:3000/api/saude',timeout=4)"
CMD ["python", "servidor.py"]
