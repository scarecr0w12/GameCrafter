#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "AudioAcceptanceActor.generated.h"
class UAudioComponent;
UCLASS()
class ACCEPTANCE_API AAudioAcceptanceActor : public AActor {
    GENERATED_BODY()
public:
    AAudioAcceptanceActor();
    virtual void Tick(float DeltaSeconds) override;
protected:
    virtual void BeginPlay() override;
private:
    UPROPERTY() TObjectPtr<UAudioComponent> Source;
    double Deadline=0;
    int32 Phase=0;
    void Record();
    void Export(const FString& Name);
};
