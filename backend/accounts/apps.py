from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = 'accounts'

    def ready(self):
        # ── Fix: unfold _flatten_context → context.flatten() crash ──────
        # Django's BaseContext.flatten() calls flat.update(d) for each d
        # in self.dicts. If ANY layer is not a proper dict (e.g. a string
        # or list pushed by unfold's component template tag), dict.update()
        # raises ValueError. Patch flatten() to skip non-Mapping layers.
        from django.template.context import BaseContext
        from collections.abc import Mapping

        _original_flatten = BaseContext.flatten

        def _safe_flatten(self):
            flat = {}
            for d in self.dicts:
                if isinstance(d, Mapping):
                    flat.update(d)
            return flat

        BaseContext.flatten = _safe_flatten
