from typing import Annotated

from fastapi import Depends

from .config import Settings, get_settings
from .database import Database
from .repositories.skillora import SkilloraRepository


def get_repository(settings: Annotated[Settings, Depends(get_settings)]) -> SkilloraRepository:
    return SkilloraRepository(Database(settings))


Repository = Annotated[SkilloraRepository, Depends(get_repository)]

