#pragma once
#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "CheckpointSave.generated.h"
UCLASS() class ACCEPTANCE_API UCheckpointSave : public USaveGame { GENERATED_BODY() public: UPROPERTY(SaveGame) int32 Health=100; UPROPERTY(SaveGame) FVector Position=FVector::ZeroVector; };
