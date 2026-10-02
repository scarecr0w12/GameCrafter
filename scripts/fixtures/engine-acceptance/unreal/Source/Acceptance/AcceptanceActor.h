#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "AcceptanceActor.generated.h"
UCLASS() class ACCEPTANCE_API AAcceptanceActor : public AActor { GENERATED_BODY() protected: virtual void BeginPlay() override; };
