# Python image for the agents' python_run tool, with the usual data libraries.
#   docker build -t loopmates-python -f docker/python.Dockerfile .
# then set PY_IMAGE=loopmates-python on the setup page (Advanced) or in the environment.
FROM python:3.12-slim
RUN pip install --no-cache-dir pandas numpy matplotlib openpyxl scipy requests
WORKDIR /w
