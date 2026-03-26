#!/usr/bin/env python3
"""Standalone document reader for the yz-doc skill."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
import hashlib
import json
from pathlib import Path
import tempfile
from typing import Any, Callable, Iterable
from urllib.parse import urlparse

import httpx

from langchain_community.document_loaders import (
    ArxivLoader,
    Docx2txtLoader,
    PyMuPDFLoader,
    TextLoader,
    UnstructuredExcelLoader,
    UnstructuredMarkdownLoader,
    UnstructuredWordDocumentLoader,
    WebBaseLoader,
)


def is_url(source: str) -> bool:
    return source.startswith(("http://", "https://"))


@dataclass
class Document:
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)
    doc_type: str = ""
    source: str = ""
    doc_id: str | None = None
    created_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.doc_id is None:
            seed = f"{self.source}:{self.content[:100]}"
            self.doc_id = f"doc_{hashlib.md5(seed.encode()).hexdigest()[:16]}"
        if self.created_at is None:
            self.created_at = datetime.now()

    def to_dict(self) -> dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "content": self.content,
            "metadata": self.metadata,
            "doc_type": self.doc_type,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ReaderError(Exception):
    pass


class DocumentReader:
    DEFAULT_WEB_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }

    LOCAL_LOADERS: dict[str, tuple[str, Callable[[Path], str]]] = {}

    def __init__(self, temp_root: str | Path | None = None):
        self.temp_root = Path(temp_root) if temp_root else Path(tempfile.gettempdir()) / "yz-doc-skill"
        self.temp_root.mkdir(parents=True, exist_ok=True)
        self.LOCAL_LOADERS = {
            ".txt": ("text", self._load_text),
            ".md": ("markdown", self._load_markdown),
            ".markdown": ("markdown", self._load_markdown),
            ".xlsx": ("excel", self._load_excel),
            ".xls": ("excel", self._load_excel),
            ".pdf": ("pdf", self._load_pdf),
            ".docx": ("docx", self._load_docx),
            ".doc": ("doc", self._load_word),
        }

    def load(self, source: str | Path) -> Document:
        source_str = str(source)
        if self._is_arxiv_url(source_str):
            content = self._load_arxiv(source_str)
            return self._build_document("arxiv", source_str, content, {"loader": "langchain_arxiv"})

        if is_url(source_str):
            return self._load_remote(source_str)

        path = Path(source_str).expanduser().resolve()
        if not path.exists():
            raise ReaderError(f"文件不存在: {source_str}")
        return self._load_local(path, source_str)

    def _load_local(self, path: Path, source_str: str) -> Document:
        suffix = path.suffix.lower()
        if suffix in self.LOCAL_LOADERS:
            doc_type, loader = self.LOCAL_LOADERS[suffix]
            content = loader(path)
            metadata = {
                "loader": "langchain",
                "file_name": path.name,
                "file_size": path.stat().st_size,
                "source_type": "file",
            }
            return self._build_document(doc_type, source_str, content, metadata)

        if suffix in {".html", ".htm"}:
            content = path.read_text(encoding="utf-8")
            return self._build_document(
                "html",
                source_str,
                content,
                {"loader": "native", "file_name": path.name, "source_type": "file"},
            )

        raise ReaderError(f"不支持的文件类型: {suffix or '[无扩展名]'}")

    def _load_remote(self, url: str) -> Document:
        parsed = urlparse(url)
        suffix = Path(parsed.path).suffix.lower()
        if self._looks_like_web(url, suffix):
            content = self._load_web(url)
            return self._build_document(
                "web",
                url,
                content,
                {"loader": "langchain_web", "url": url, "source_type": "web"},
            )

        if suffix not in self.LOCAL_LOADERS:
            raise ReaderError(f"远程地址暂不支持该类型: {suffix or '[无扩展名]'}")

        downloaded = self._download(url, suffix)
        doc_type, loader = self.LOCAL_LOADERS[suffix]
        content = loader(downloaded)
        metadata = {
            "loader": "langchain",
            "url": url,
            "download_path": str(downloaded),
            "source_type": "remote_file",
        }
        return self._build_document(doc_type, url, content, metadata)

    def _download(self, url: str, suffix: str) -> Path:
        digest = hashlib.md5(url.encode()).hexdigest()[:16]
        file_name = Path(urlparse(url).path).name or f"{digest}{suffix}"
        target = self.temp_root / f"{digest}_{file_name}"

        with httpx.Client(follow_redirects=True, timeout=60.0) as client:
            response = client.get(url)
            response.raise_for_status()
            target.write_bytes(response.content)

        return target

    def _load_text(self, path: Path) -> str:
        loader = TextLoader(str(path), autodetect_encoding=True)
        return self._join_documents(loader.load())

    def _load_markdown(self, path: Path) -> str:
        loader = UnstructuredMarkdownLoader(str(path), mode="single")
        return self._join_documents(loader.load())

    def _load_excel(self, path: Path) -> str:
        loader = UnstructuredExcelLoader(str(path), mode="single")
        return self._join_documents(loader.load())

    def _load_pdf(self, path: Path) -> str:
        loader = PyMuPDFLoader(str(path))
        return self._join_documents(loader.load())

    def _load_docx(self, path: Path) -> str:
        loader = Docx2txtLoader(str(path))
        return self._join_documents(loader.load())

    def _load_word(self, path: Path) -> str:
        loader = UnstructuredWordDocumentLoader(str(path), mode="single")
        return self._join_documents(loader.load())

    def _load_web(self, url: str) -> str:
        loader = WebBaseLoader(web_paths=[url], header_template=self.DEFAULT_WEB_HEADERS)
        return self._join_documents(loader.load())

    def _load_arxiv(self, url: str) -> str:
        paper_id = self._extract_arxiv_id(url)
        if not paper_id:
            raise ReaderError(f"无法从 arXiv 链接识别论文 ID: {url}")
        loader = ArxivLoader(query=paper_id, load_max_docs=1, load_all_available_meta=True)
        return self._join_documents(loader.load())

    def _join_documents(self, docs: Iterable[Any]) -> str:
        parts: list[str] = []
        for doc in docs:
            if hasattr(doc, "page_content"):
                parts.append(str(doc.page_content))
            elif isinstance(doc, dict):
                parts.append(str(doc.get("page_content", "")))
        return "\n\n".join(part for part in parts if part).strip()

    def _build_document(
        self, doc_type: str, source: str, content: str, metadata: dict[str, Any]
    ) -> Document:
        if not content:
            raise ReaderError(f"读取结果为空: {source}")
        return Document(content=content, doc_type=doc_type, source=source, metadata=metadata)

    def _looks_like_web(self, url: str, suffix: str) -> bool:
        if "mp.weixin.qq.com" in url:
            return True
        if not suffix:
            return True
        return suffix in {".html", ".htm"}

    def _is_arxiv_url(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()
        return "arxiv.org" in host

    def _extract_arxiv_id(self, url: str) -> str:
        path = urlparse(url).path.strip("/")
        if path.startswith("abs/"):
            return path.split("/", 1)[1]
        if path.startswith("pdf/"):
            value = path.split("/", 1)[1]
            return value[:-4] if value.endswith(".pdf") else value
        return ""


def dump_large_content(
    document: Document,
    output_text: str,
    assets_dir: str | Path,
    threshold: int,
    output_format: str,
) -> tuple[str, str | None]:
    if len(document.content) <= threshold:
        return output_text, None

    assets_path = Path(assets_dir)
    assets_path.mkdir(parents=True, exist_ok=True)
    suffix = ".json" if output_format == "json" else ".md" if output_format == "markdown" else ".txt"
    file_name = f"{document.doc_id}{suffix}"
    target = assets_path / file_name
    target.write_text(output_text, encoding="utf-8")

    payload = {
        "message": "内容过长，已写入 assets 文件",
        "doc_id": document.doc_id,
        "doc_type": document.doc_type,
        "source": document.source,
        "saved_to": str(target),
        "content_length": len(document.content),
    }
    return json.dumps(payload, ensure_ascii=False, indent=2), str(target)
