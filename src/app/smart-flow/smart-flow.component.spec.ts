import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SmartFlowComponent } from './smart-flow.component';

describe('SmartFlowComponent', () => {
  let component: SmartFlowComponent;
  let fixture: ComponentFixture<SmartFlowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SmartFlowComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SmartFlowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
