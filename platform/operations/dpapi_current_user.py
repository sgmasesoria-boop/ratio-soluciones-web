import ctypes
import subprocess
from ctypes import wintypes
from pathlib import Path


class DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_ubyte))]


CRYPTPROTECT_UI_FORBIDDEN = 0x01
ENTROPY = b"RatioSoluciones|OCR|v1"
CRYPT32 = ctypes.windll.crypt32
KERNEL32 = ctypes.windll.kernel32
CRYPT32.CryptProtectData.argtypes = [
    ctypes.POINTER(DataBlob), wintypes.LPCWSTR, ctypes.POINTER(DataBlob),
    ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DataBlob),
]
CRYPT32.CryptProtectData.restype = wintypes.BOOL
CRYPT32.CryptUnprotectData.argtypes = [
    ctypes.POINTER(DataBlob), ctypes.c_void_p, ctypes.POINTER(DataBlob),
    ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DataBlob),
]
CRYPT32.CryptUnprotectData.restype = wintypes.BOOL
KERNEL32.LocalFree.argtypes = [ctypes.c_void_p]
KERNEL32.LocalFree.restype = ctypes.c_void_p


def make_blob(data: bytes):
    buffer = ctypes.create_string_buffer(data)
    return DataBlob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte))), buffer


def powershell_dpapi(data: bytes, operation: str) -> bytes:
    helper = Path(__file__).with_name("dpapi-memory-pipe.ps1")
    completed = subprocess.run(
        [
            r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
            "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-File", str(helper), "-Operation", operation,
        ],
        input=data,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0 or not completed.stdout:
        raise RuntimeError("WINDOWS_DPAPI_MEMORY_PIPE_FAILED")
    return completed.stdout


def protect_current_user(data: bytes) -> bytes:
    input_blob, input_buffer = make_blob(data)
    entropy_blob, entropy_buffer = make_blob(ENTROPY)
    output_blob = DataBlob()
    ok = CRYPT32.CryptProtectData(
        ctypes.byref(input_blob), "Ratio Soluciones local knowledge",
        ctypes.byref(entropy_blob), None, None, CRYPTPROTECT_UI_FORBIDDEN,
        ctypes.byref(output_blob),
    )
    _ = input_buffer, entropy_buffer
    if not ok:
        return powershell_dpapi(data, "protect")
    try:
        return ctypes.string_at(output_blob.pbData, output_blob.cbData)
    finally:
        KERNEL32.LocalFree(output_blob.pbData)


def unprotect_current_user(data: bytes) -> bytes:
    input_blob, input_buffer = make_blob(data)
    entropy_blob, entropy_buffer = make_blob(ENTROPY)
    output_blob = DataBlob()
    ok = CRYPT32.CryptUnprotectData(
        ctypes.byref(input_blob), None, ctypes.byref(entropy_blob), None, None,
        CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(output_blob),
    )
    _ = input_buffer, entropy_buffer
    if not ok:
        return powershell_dpapi(data, "unprotect")
    try:
        return ctypes.string_at(output_blob.pbData, output_blob.cbData)
    finally:
        KERNEL32.LocalFree(output_blob.pbData)

