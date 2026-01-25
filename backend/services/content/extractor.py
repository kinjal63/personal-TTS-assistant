from __future__ import annotations

import httpx
from trafilatura import extract, fetch_url
from trafilatura.settings import use_config
from bs4 import BeautifulSoup
from typing import TypedDict


class ExtractedContent(TypedDict):
    title: str
    content: str
    site_name: str | None


class ContentExtractor:
    """Extract readable content from web pages"""

    def __init__(self):
        # Configure trafilatura for better extraction
        self.config = use_config()
        self.config.set("DEFAULT", "EXTRACTION_TIMEOUT", "30")

    async def extract_from_url(self, url: str) -> ExtractedContent | None:
        """Fetch and extract content from a URL"""
        try:
            # Fetch the page
            async with httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
                html = response.text

            return self.extract_from_html(html, url)

        except httpx.HTTPError as e:
            print(f"HTTP error fetching {url}: {e}")
            return None
        except Exception as e:
            print(f"Error extracting from {url}: {e}")
            return None

    def extract_from_html(self, html: str, url: str | None = None) -> ExtractedContent | None:
        """Extract content from HTML string"""
        try:
            # Try trafilatura first (best for articles)
            content = extract(
                html,
                include_comments=False,
                include_tables=False,
                include_images=False,
                include_links=False,
                output_format="txt",
                url=url,
                config=self.config,
            )

            # Get title from HTML
            title = self._extract_title(html)
            site_name = self._extract_site_name(html)

            if content and len(content.strip()) > 100:
                return ExtractedContent(
                    title=title,
                    content=content,
                    site_name=site_name,
                )

            # Fallback to BeautifulSoup
            fallback_content = self._fallback_extract(html)
            if fallback_content:
                return ExtractedContent(
                    title=title,
                    content=fallback_content,
                    site_name=site_name,
                )

            return None

        except Exception as e:
            print(f"Error extracting content: {e}")
            return None

    def _extract_title(self, html: str) -> str:
        """Extract page title from HTML"""
        soup = BeautifulSoup(html, "html.parser")

        # Try og:title first
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            return og_title["content"]

        # Try regular title tag
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            return title_tag.string.strip()

        # Try h1
        h1 = soup.find("h1")
        if h1:
            return h1.get_text().strip()

        return "Untitled"

    def _extract_site_name(self, html: str) -> str | None:
        """Extract site name from HTML"""
        soup = BeautifulSoup(html, "html.parser")

        og_site = soup.find("meta", property="og:site_name")
        if og_site and og_site.get("content"):
            return og_site["content"]

        return None

    def _fallback_extract(self, html: str) -> str | None:
        """Fallback extraction using BeautifulSoup"""
        soup = BeautifulSoup(html, "html.parser")

        # Remove unwanted elements
        for tag in soup.find_all(
            ["script", "style", "nav", "header", "footer", "aside", "form", "iframe"]
        ):
            tag.decompose()

        # Try to find main content
        main = (
            soup.find("main")
            or soup.find("article")
            or soup.find("div", class_="content")
            or soup.find("div", class_="post")
            or soup.find("div", id="content")
        )

        if main:
            text = main.get_text(separator="\n")
        else:
            body = soup.find("body")
            text = body.get_text(separator="\n") if body else ""

        # Clean up whitespace
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        content = "\n".join(lines)

        if len(content) > 100:
            return content

        return None
