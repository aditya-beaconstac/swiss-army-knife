import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

@Component({
  selector: 'app-smart-flow',
  templateUrl: './smart-flow.component.html',
  styleUrls: ['./smart-flow.component.scss']
})
export class SmartFlowComponent implements OnDestroy {
  private static readonly NODE_WIDTH = 240;
  private static readonly NODE_HEIGHT = 120;
  private static readonly NODE_MARGIN = 24;
  private static readonly CANVAS_TOP_OFFSET = 110;
  private static readonly STORAGE_KEY = 'smart-flow:saved-flows';

  @ViewChild('workspaceGrid', { static: false }) workspaceGrid?: ElementRef<HTMLDivElement>;
  @ViewChild('defaultSourceRef', { static: false }) defaultSourceRef?: ElementRef<HTMLDivElement>;
  @ViewChild('defaultDestinationRef', { static: false }) defaultDestinationRef?: ElementRef<HTMLDivElement>;
  readonly criteriaOptions: CriteriaOption[] = [
    { value: 'day', label: 'Day' },
    { value: 'country', label: 'Country' },
    { value: 'device-language', label: 'Device Language' },
    { value: 'device-os', label: 'Device OS' }
  ];

  readonly operatorOptions: CriteriaOption[] = [
    { value: 'is', label: 'Is' },
    { value: 'is-not', label: 'Is not' }
  ];

  private readonly criteriaValueMap: Record<CriteriaKey, CriteriaOption[]> = {
    day: [
      { value: 'monday', label: 'Monday' },
      { value: 'tuesday', label: 'Tuesday' },
      { value: 'wednesday', label: 'Wednesday' },
      { value: 'thursday', label: 'Thursday' },
      { value: 'friday', label: 'Friday' },
      { value: 'saturday', label: 'Saturday' },
      { value: 'sunday', label: 'Sunday' }
    ],
    country: [
      { value: 'us', label: 'United States' },
      { value: 'ca', label: 'Canada' },
      { value: 'ch', label: 'Switzerland' },
      { value: 'de', label: 'Germany' },
      { value: 'in', label: 'India' }
    ],
    'device-language': [
      { value: 'en', label: 'English' },
      { value: 'de', label: 'German' },
      { value: 'fr', label: 'French' },
      { value: 'it', label: 'Italian' }
    ],
    'device-os': [
      { value: 'ios', label: 'iOS' },
      { value: 'android', label: 'Android' },
      { value: 'macos', label: 'macOS' },
      { value: 'windows', label: 'Windows' }
    ]
  };

  showNodePicker = false;
  showConditionConfig = false;
  showDestinationConfig = false;
  editingDefaultDestination = false;
  selectedCriteria: CriteriaKey | '' = 'day';
  selectedOperator: OperatorKey = 'is';
  selectedCriteriaValue = 'sunday';
  selectedCriteriaLabel = this.criteriaOptions[0].label;
  criteriaValueOptions: CriteriaOption[] = this.criteriaValueMap['day'];
  conditionPreview = this.buildConditionPreview();
  conditionError: string | null = null;
  destinationName = '';
  destinationUrl = '';
  defaultDestinationUrl = '';
  connections: SmartFlowConnection[] = [];
  connectionPreview: ConnectionPreview | null = null;
  showFlowJson = false;
  flowJsonSnapshot: FlowSnapshot | null = null;
  showSaveFlowModal = false;
  flowNameInput = '';
  flowNameError: string | null = null;
  pendingSnapshot: FlowSnapshot | null = null;
  savedFlows: SavedFlow[] = [];
  showSimulationModal = false;
  simulationError: string | null = null;
  simulationAssignments: Record<string, string> = {};
  simulationPreviewObject: SimulationPreviewPayload | null = null;
  simulationResult: SimulationResult | null = null;
  nodes: SmartFlowNode[] = [];
  private nodeIdCounter = 1;
  private connectionIdCounter = 1;
  draggingNodeId: number | null = null;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private connectionDragSource: ConnectionDragSource | null = null;

  constructor() {
    this.loadSavedFlowsFromStorage();
    this.initializeSimulationAssignments(true);
  }

  openNodePicker(): void {
    this.showConditionConfig = false;
    this.showDestinationConfig = false;
    this.editingDefaultDestination = false;
    this.showNodePicker = true;
    this.resetCriteriaSelection();
    this.resetDestinationForm();
  }

  closeNodePicker(): void {
    this.showNodePicker = false;
    this.showConditionConfig = false;
    this.showDestinationConfig = false;
    this.editingDefaultDestination = false;
    this.resetCriteriaSelection();
    this.resetDestinationForm();
  }

  selectNode(type: 'condition' | 'destination'): void {
    if (type === 'condition') {
      this.showNodePicker = false;
      this.showConditionConfig = true;
      return;
    }

    if (type === 'destination') {
      this.showNodePicker = false;
      this.showDestinationConfig = true;
      this.editingDefaultDestination = false;
      this.resetDestinationForm();
    }
  }

  closeConditionConfig(): void {
    this.showConditionConfig = false;
    this.resetCriteriaSelection();
    this.conditionError = null;
    this.conditionError = null;
    this.conditionError = null;
  }

  closeDestinationConfig(): void {
    this.showDestinationConfig = false;
    this.editingDefaultDestination = false;
    this.resetDestinationForm();
  }

  openDefaultDestinationConfig(): void {
    this.showDestinationConfig = true;
    this.editingDefaultDestination = true;
    this.destinationName = 'Default Destination';
    this.destinationUrl = this.defaultDestinationUrl;
  }

  saveCondition(): void {
    const label = this.conditionPreview || 'Condition';
    if (this.isDuplicateCondition(label)) {
      this.conditionError = 'This condition already exists.';
      return;
    }
    this.conditionError = null;
    this.addNode({
      id: this.nodeIdCounter++,
      type: 'condition',
      label,
      metadata: {
        criteria: (this.selectedCriteria as CriteriaKey) ?? 'day',
        operator: this.selectedOperator,
        value: this.selectedCriteriaValue,
        label
      }
    });
    this.closeConditionConfig();
  }

  saveDestination(): void {
    const trimmedName = this.destinationName.trim();
    const trimmedUrl = this.destinationUrl.trim();
    const label = trimmedName || trimmedUrl || 'Destination';

    if (this.editingDefaultDestination) {
      this.defaultDestinationUrl = trimmedUrl;
      this.closeDestinationConfig();
      return;
    }

    this.addNode({
      id: this.nodeIdCounter++,
      type: 'destination',
      label,
      metadata: {
        destinationUrl: trimmedUrl || null
      }
    });

    this.closeDestinationConfig();
  }

  removeNode(nodeId: number): void {
    this.nodes = this.nodes.filter(node => node.id !== nodeId);
    this.connections = this.connections.filter(
      connection => connection.from !== nodeId && connection.to !== nodeId
    );
  }

  saveFlow(): void {
    if (!this.isFlowValid) {
      return;
    }
    this.pendingSnapshot = this.buildFlowSnapshot();
    this.flowNameInput = '';
    this.flowNameError = null;
    this.showSaveFlowModal = true;
  }

  closeFlowJsonModal(): void {
    this.showFlowJson = false;
    this.flowJsonSnapshot = null;
  }

  confirmFlowSave(): void {
    if (!this.pendingSnapshot) {
      return;
    }
    const trimmedName = this.flowNameInput.trim();
    if (!trimmedName) {
      this.flowNameError = 'Please provide a flow name.';
      return;
    }
    if (this.savedFlows.some(flow => flow.name.toLowerCase() === trimmedName.toLowerCase())) {
      this.flowNameError = 'A flow with this name already exists.';
      return;
    }

    this.savedFlows = [
      {
        id: `flow-${Date.now()}`,
        name: trimmedName,
        snapshot: this.pendingSnapshot
      },
      ...this.savedFlows
    ];
    this.persistSavedFlows();

    this.showSaveFlowModal = false;
    this.pendingSnapshot = null;
    this.flowNameInput = '';
    this.flowNameError = null;
    this.clearCanvas();
  }

  cancelFlowSave(): void {
    this.showSaveFlowModal = false;
    this.flowNameInput = '';
    this.flowNameError = null;
    this.pendingSnapshot = null;
  }

  loadSavedFlow(flow: SavedFlow): void {
    this.applyFlowSnapshot(flow.snapshot);
  }

  removeSavedFlow(flowId: string, event: Event): void {
    event.stopPropagation();
    this.savedFlows = this.savedFlows.filter(flow => flow.id !== flowId);
    this.persistSavedFlows();
  }

  clearAll(): void {
    this.clearCanvas();
  }

  openSimulation(): void {
    if (!this.isFlowValid) {
      return;
    }
    this.initializeSimulationAssignments();
    this.simulationError = null;
    this.simulationResult = null;
    this.showSimulationModal = true;
  }

  closeSimulation(): void {
    this.showSimulationModal = false;
    this.simulationError = null;
    this.simulationResult = null;
  }

  runSimulation(): void {
    if (!this.getConditionNodes().length) {
      this.simulationError = 'Add at least one condition to run simulation.';
      this.simulationResult = null;
      return;
    }
    const payload = this.simulationPreviewObject ?? this.buildSimulationPreviewPayload();
    const destination = this.evaluateFlow(payload);
    this.simulationResult = {
      timestamp: new Date().toISOString(),
      payload,
      destination
    };
    this.simulationError = null;
  }

  onCriteriaChange(criteria: string): void {
    this.selectedCriteria = criteria as CriteriaKey;
    const valueOptions = this.criteriaValueMap[this.selectedCriteria];
    this.criteriaValueOptions = valueOptions ?? [];
    this.selectedCriteriaLabel =
      this.criteriaOptions.find(option => option.value === this.selectedCriteria)?.label ?? '';
    this.selectedCriteriaValue = valueOptions?.[0]?.value ?? '';
    this.updateConditionPreview();
  }

  onCriteriaValueChange(value: string): void {
    this.selectedCriteriaValue = value;
    this.updateConditionPreview();
  }

  onOperatorChange(operator: string): void {
    this.selectedOperator = operator as OperatorKey;
    this.updateConditionPreview();
  }

  startConnectionDrag(event: PointerEvent, node: SmartFlowNode, port: ConnectionPort): void {
    this.beginConnectionDrag(event, node.id, port);
  }

  startDefaultConnectionDrag(event: PointerEvent): void {
    this.beginConnectionDrag(event, 'default-source', 'success');
  }

  startDrag(event: PointerEvent, node: SmartFlowNode): void {
    const workspaceRect = this.getWorkspaceRect();
    if (!workspaceRect) {
      return;
    }

    event.preventDefault();
    this.draggingNodeId = node.id;
    const pointerX = event.clientX - workspaceRect.left;
    const pointerY = event.clientY - workspaceRect.top;

    this.dragOffset = {
      x: pointerX - node.x,
      y: pointerY - node.y
    };

    this.detachPointerListeners();
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  trackNode(_: number, node: SmartFlowNode): number {
    return node.id;
  }

  ngOnDestroy(): void {
    this.draggingNodeId = null;
    this.detachPointerListeners();
    this.connectionDragSource = null;
    this.detachConnectionListeners();
  }

  private resetCriteriaSelection(): void {
    this.selectedCriteria = 'day';
    this.selectedCriteriaLabel =
      this.criteriaOptions.find(option => option.value === this.selectedCriteria)?.label ?? '';
    this.criteriaValueOptions = this.criteriaValueMap['day'];
    this.selectedCriteriaValue = 'sunday';
    this.selectedOperator = 'is';
    this.updateConditionPreview();
    this.conditionError = null;
  }

  private addNode(node: Omit<SmartFlowNode, 'x' | 'y'>): void {
    const { x, y } = this.getInitialNodePosition();
    this.nodes = [...this.nodes, { ...node, x, y }];
  }

  private countNodesByType(type: SmartFlowNode['type']): number {
    return this.nodes.filter(node => node.type === type).length;
  }

  private updateConditionPreview(): void {
    this.conditionPreview = this.buildConditionPreview();
  }

  private buildConditionPreview(): string {
    const valueLabel =
      this.criteriaValueOptions.find(option => option.value === this.selectedCriteriaValue)?.label ||
      '';
    return `${this.selectedCriteriaLabel} ${this.getOperatorLabel()} ${valueLabel}`.trim();
  }

  private getOperatorLabel(): string {
    return (
      this.operatorOptions.find(option => option.value === this.selectedOperator)?.label ?? ''
    );
  }

  private addConnection(
    fromId: NodeIdentifier,
    toId: NodeIdentifier,
    port: ConnectionPort
  ): void {
    if (this.isReverseConnection(fromId, toId)) {
      this.connectionDragSource = null;
      this.connectionPreview = null;
      this.detachConnectionListeners();
      return;
    }

    this.connections = [
      ...this.connections.filter(
        connection => !(connection.from === fromId && connection.port === port)
      ),
      {
        id: this.connectionIdCounter++,
        from: fromId,
        to: toId,
        port
      }
    ];
  }

  private isReverseConnection(fromId: NodeIdentifier, toId: NodeIdentifier): boolean {
    return this.connections.some(
      connection => connection.from === toId && connection.to === fromId
    );
  }

  private isDuplicateCondition(label: string): boolean {
    return this.nodes.some(node => node.type === 'condition' && node.label === label);
  }

  private hasConnectionForPort(nodeId: number, port: ConnectionPort): boolean {
    return this.connections.some(
      connection => connection.from === nodeId && connection.port === port
    );
  }

  private get hasConditionNodes(): boolean {
    return this.nodes.some(node => node.type === 'condition');
  }

  private beginConnectionDrag(
    event: PointerEvent,
    nodeId: NodeIdentifier,
    port: ConnectionPort
  ): void {
    const workspaceRect = this.getWorkspaceRect();
    if (!workspaceRect) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    this.connectionDragSource = { nodeId, port };
    const startPoint = this.getConnectionStartPoint(nodeId, port);
    this.connectionPreview = {
      x1: startPoint.x,
      y1: startPoint.y,
      x2: startPoint.x,
      y2: startPoint.y,
      port
    };

    this.detachConnectionListeners();
    window.addEventListener('pointermove', this.handleConnectionPointerMove);
    window.addEventListener('pointerup', this.handleConnectionPointerUp);
  }

  private getConnectionStartPoint(nodeId: NodeIdentifier, port: ConnectionPort): Point {
    if (typeof nodeId === 'number') {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) {
        return { x: 0, y: 0 };
      }
      const isSuccess = port === 'success';
      const offsetY = isSuccess
        ? SmartFlowComponent.NODE_HEIGHT * 0.35
        : SmartFlowComponent.NODE_HEIGHT * 0.65;
      return {
        x: node.x + SmartFlowComponent.NODE_WIDTH,
        y: node.y + offsetY
      };
    }

    const rect = this.getSpecialNodeRect(nodeId);
    if (!rect) {
      return { x: 0, y: 0 };
    }

    if (nodeId === 'default-source') {
      return {
        x: rect.x + rect.width,
        y: rect.y + rect.height / 2
      };
    }

    return {
      x: rect.x,
      y: rect.y + rect.height / 2
    };
  }

  private findNodeAt(x: number, y: number): NodeIdentifier | null {
    for (const node of this.nodes) {
      if (
        x >= node.x &&
        x <= node.x + SmartFlowComponent.NODE_WIDTH &&
        y >= node.y &&
        y <= node.y + SmartFlowComponent.NODE_HEIGHT
      ) {
        return node.id;
      }
    }

    if (this.pointInSpecialNode(x, y, 'default-destination')) {
      return 'default-destination';
    }

    return null;
  }

  private pointInSpecialNode(x: number, y: number, type: SpecialNodeIdentifier): boolean {
    const rect = this.getSpecialNodeRect(type);
    if (!rect) {
      return false;
    }
    return this.isPointInRect(x, y, rect);
  }

  private getSpecialNodeRect(type: SpecialNodeIdentifier): Rect | null {
    const workspaceRect = this.getWorkspaceRect();
    if (!workspaceRect) {
      return null;
    }

    let elementRef: ElementRef<HTMLDivElement> | undefined;
    if (type === 'default-destination') {
      elementRef = this.defaultDestinationRef;
    } else {
      elementRef = this.defaultSourceRef;
    }

    const element = elementRef?.nativeElement;
    if (!element) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    return {
      x: rect.left - workspaceRect.left,
      y: rect.top - workspaceRect.top,
      width: rect.width,
      height: rect.height
    };
  }

  private isPointInRect(x: number, y: number, rect: Rect): boolean {
    return (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    );
  }

  private convertClientToWorkspace(clientX: number, clientY: number): Point | null {
    const workspaceRect = this.getWorkspaceRect();
    if (!workspaceRect) {
      return null;
    }
    return {
      x: clientX - workspaceRect.left,
      y: clientY - workspaceRect.top
    };
  }

  private isSameEndpoint(a: NodeIdentifier, b: NodeIdentifier): boolean {
    if (typeof a === 'number' && typeof b === 'number') {
      return a === b;
    }
    return a === b;
  }

  getConnectionPath(connection: SmartFlowConnection): string {
    const points = this.getConnectionPoints(connection);
    return this.buildConnectionPath(points);
  }

  getPreviewPath(): string | null {
    if (!this.connectionPreview) {
      return null;
    }
    return this.buildConnectionPath(this.connectionPreview);
  }

  getConnectionMarker(connection: SmartFlowConnection): string {
    if (connection.from === 'default-source') {
      return 'url(#connection-arrow-default)';
    }

    if (connection.port === 'danger') {
      return 'url(#connection-arrow-danger)';
    }

    return 'url(#connection-arrow-success)';
  }

  private getConnectionPoints(connection: SmartFlowConnection): ConnectionPoints {
    const start = this.getConnectionStartPoint(connection.from, connection.port);
    const end = this.getNodeEntryPoint(connection.to);
    return {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      port: connection.port,
      from: connection.from
    };
  }

  private getNodeEntryPoint(nodeId: NodeIdentifier): Point {
    if (typeof nodeId === 'number') {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) {
        return { x: 0, y: 0 };
      }
      return {
        x: node.x,
        y: node.y + SmartFlowComponent.NODE_HEIGHT / 2
      };
    }

    const rect = this.getSpecialNodeRect(nodeId);
    if (!rect) {
      return { x: 0, y: 0 };
    }

    const attachFromLeft = nodeId === 'default-destination';
    const attachFromRight = nodeId === 'default-source';
    return {
      x: attachFromLeft
        ? rect.x
        : attachFromRight
          ? rect.x + rect.width
          : rect.x,
      y: rect.y + rect.height / 2
    };
  }

  private buildConnectionPath(points: ConnectionPoints): string {
    const { x1, y1, x2, y2 } = points;
    const deltaX = Math.max(Math.abs(x2 - x1) * 0.5, 40);
    const controlPoint1 = { x: x1 + deltaX, y: y1 };
    const controlPoint2 = { x: x2 - deltaX, y: y2 };
    return `M ${x1} ${y1} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${x2} ${y2}`;
  }

  connectionClass(connection: SmartFlowConnection): Record<string, boolean> {
    return {
      'connection-line--success': connection.port === 'success' && connection.from !== 'default-source',
      'connection-line--danger': connection.port === 'danger',
      'connection-line--default-source': connection.from === 'default-source'
    };
  }

  get isFlowValid(): boolean {
    const conditionNodes = this.nodes.filter(node => node.type === 'condition');
    const conditionsValid = conditionNodes.length > 0 && conditionNodes.every(
      node =>
        this.hasConnectionForPort(node.id, 'success') &&
        this.hasConnectionForPort(node.id, 'danger')
    );

    const defaultSourceConnected = this.connections.some(
      connection => connection.from === 'default-source'
    );

    return conditionsValid && defaultSourceConnected;
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.draggingNodeId === null) {
      return;
    }

    const workspaceRect = this.getWorkspaceRect();
    if (!workspaceRect) {
      return;
    }

    const pointerX = event.clientX - workspaceRect.left;
    const pointerY = event.clientY - workspaceRect.top;

    const minX = SmartFlowComponent.NODE_MARGIN;
    const minY = SmartFlowComponent.CANVAS_TOP_OFFSET;
    const maxX =
      workspaceRect.width - SmartFlowComponent.NODE_WIDTH - SmartFlowComponent.NODE_MARGIN;
    const maxY =
      workspaceRect.height - SmartFlowComponent.NODE_HEIGHT - SmartFlowComponent.NODE_MARGIN;

    const newX = this.clamp(pointerX - this.dragOffset.x, minX, maxX);
    const newY = this.clamp(pointerY - this.dragOffset.y, minY, maxY);

    this.nodes = this.nodes.map(node =>
      node.id === this.draggingNodeId ? { ...node, x: newX, y: newY } : node
    );
  };

  private handlePointerUp = (): void => {
    if (this.draggingNodeId === null) {
      return;
    }
    this.draggingNodeId = null;
    this.detachPointerListeners();
  };

  private detachPointerListeners(): void {
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
  }

  private handleConnectionPointerMove = (event: PointerEvent): void => {
    if (!this.connectionDragSource) {
      return;
    }

    const pointer = this.convertClientToWorkspace(event.clientX, event.clientY);
    if (!pointer) {
      return;
    }

    const startPoint = this.getConnectionStartPoint(
      this.connectionDragSource.nodeId,
      this.connectionDragSource.port
    );

    this.connectionPreview = {
      x1: startPoint.x,
      y1: startPoint.y,
      x2: pointer.x,
      y2: pointer.y,
      port: this.connectionDragSource.port
    };
  };

  private handleConnectionPointerUp = (event: PointerEvent): void => {
    if (!this.connectionDragSource) {
      return;
    }

    const pointer = this.convertClientToWorkspace(event.clientX, event.clientY);
    if (pointer) {
      const target = this.findNodeAt(pointer.x, pointer.y);
      if (target && !this.isSameEndpoint(this.connectionDragSource.nodeId, target)) {
        this.addConnection(this.connectionDragSource.nodeId, target, this.connectionDragSource.port);
      }
    }

    this.connectionDragSource = null;
    this.connectionPreview = null;
    this.detachConnectionListeners();
  };

  private detachConnectionListeners(): void {
    window.removeEventListener('pointermove', this.handleConnectionPointerMove);
    window.removeEventListener('pointerup', this.handleConnectionPointerUp);
  }

  private getWorkspaceRect(): DOMRect | null {
    return this.workspaceGrid?.nativeElement.getBoundingClientRect() ?? null;
  }

  private getInitialNodePosition(): { x: number; y: number } {
    const rect = this.getWorkspaceRect();
    const margin = SmartFlowComponent.NODE_MARGIN;
    const topOffset = SmartFlowComponent.CANVAS_TOP_OFFSET;
    if (!rect) {
      return {
        x: margin + (this.nodes.length % 3) * (SmartFlowComponent.NODE_WIDTH + margin),
        y:
          topOffset +
          Math.floor(this.nodes.length / 3) * (SmartFlowComponent.NODE_HEIGHT + margin)
      };
    }

    const column = this.nodes.length % 3;
    const row = Math.floor(this.nodes.length / 3);
    const x =
      margin + column * (SmartFlowComponent.NODE_WIDTH + margin * 2);
    const y =
      topOffset +
      row * (SmartFlowComponent.NODE_HEIGHT + margin * 2);

    const maxX = rect.width - SmartFlowComponent.NODE_WIDTH - margin;
    const maxY = rect.height - SmartFlowComponent.NODE_HEIGHT - margin;

    return {
      x: this.clamp(x, margin, maxX),
      y: this.clamp(y, topOffset, maxY)
    };
  }

  private clamp(value: number, min: number, max: number): number {
    if (max < min) {
      return min;
    }
    return Math.min(Math.max(value, min), max);
  }

  private resetDestinationForm(): void {
    this.destinationName = '';
    this.destinationUrl = '';
  }

  private clearCanvas(): void {
    this.nodes = [];
    this.connections = [];
    this.connectionPreview = null;
    this.connectionDragSource = null;
    this.draggingNodeId = null;
    this.resetCriteriaSelection();
    this.resetDestinationForm();
    this.defaultDestinationUrl = '';
    this.showConditionConfig = false;
    this.showDestinationConfig = false;
    this.editingDefaultDestination = false;
    this.updateSimulationPreview();
  }

  private evaluateFlow(payload: SimulationPreviewPayload): SimulationDestination {
    const defaultDestination = this.defaultDestinationUrl || 'Default Destination';
    const attributes = payload?.attributes ?? {};

    let current: NodeIdentifier = 'default-source';
    const visited = new Set<NodeIdentifier>();
    let safety = 0;

    while (safety < 100) {
      safety += 1;
      if (visited.has(current)) {
        break;
      }
      visited.add(current);

      const connection = this.resolveNextConnection(current, attributes);
      if (!connection) {
        break;
      }

      const target = connection.to;

      if (target === 'default-destination') {
        return { label: defaultDestination, url: this.defaultDestinationUrl || null };
      }

      if (typeof target === 'number') {
        const node = this.getNodeById(target);
        if (!node) {
          break;
        }

        if (node.type === 'destination') {
          const destinationMetadata = node.metadata as DestinationMetadata | undefined;
          return { label: node.label, url: destinationMetadata?.destinationUrl ?? null };
        }

        current = target;
        continue;
      }

      current = target;
    }

    return { label: defaultDestination, url: this.defaultDestinationUrl || null };
  }

  private resolveNextConnection(
    from: NodeIdentifier,
    attributes: Record<string, string>
  ): SmartFlowConnection | undefined {
    if (from === 'default-source') {
      return this.connections.find(connection => connection.from === 'default-source');
    }

    const node = typeof from === 'number' ? this.getNodeById(from) : undefined;
    if (!node) {
      return this.connections.find(connection => connection.from === from);
    }

    if (node.type !== 'condition') {
      return this.connections.find(connection => connection.from === from);
    }

    const metadata = node.metadata as ConditionMetadata | undefined;
    const criteriaKey = metadata?.criteria;
    const expectedValue = metadata?.value ?? '';
    const operator = metadata?.operator ?? 'is';
    const actualValue = criteriaKey ? attributes[criteriaKey] ?? '' : '';

    const matches = operator === 'is' ? actualValue === expectedValue : actualValue !== expectedValue;
    const desiredPort: ConnectionPort = matches ? 'success' : 'danger';

    return (
      this.connections.find(
        connection => connection.from === from && connection.port === desiredPort
      ) || this.connections.find(connection => connection.from === from)
    );
  }

  private getNodeById(id: number): SmartFlowNode | undefined {
    return this.nodes.find(node => node.id === id);
  }

  private initializeSimulationAssignments(force = false): void {
    const assignments: Record<string, string> = { ...this.simulationAssignments };

    this.criteriaOptions.forEach(option => {
      const key = option.value as CriteriaKey;
      if (force || !assignments[key]) {
        const values = this.getValueOptions(key);
        assignments[key] = values[0]?.value ?? '';
      }
    });

    this.simulationAssignments = assignments;
    this.updateSimulationPreview();
  }

  updateSimulationAssignment(criteria: string, value: string): void {
    this.simulationAssignments = {
      ...this.simulationAssignments,
      [criteria]: value
    };
    this.updateSimulationPreview();
  }

  private updateSimulationPreview(): void {
    this.simulationPreviewObject = this.buildSimulationPreviewPayload();
  }

  private buildSimulationPreviewPayload(): SimulationPreviewPayload {
    const attributes: Record<string, string> = {};
    this.criteriaOptions.forEach(option => {
      const key = option.value;
      attributes[key] = this.simulationAssignments[key] ?? '';
    });

    return {
      generatedAt: new Date().toISOString(),
      attributes
    };
  }

  private buildFlowSnapshot(): FlowSnapshot {
    const nodes: FlowSnapshotNode[] = [
      {
        id: 'default-source',
        type: 'default-source',
        label: 'QR Code Scanned'
      },
      {
        id: 'default-destination',
        type: 'default-destination',
        label: 'Destination',
        metadata: {
          url: this.defaultDestinationUrl || null
        } as DefaultDestinationMetadata
      },
      ...this.nodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        position: { x: node.x, y: node.y },
        metadata: node.metadata ?? null
      }))
    ];

    const connections: FlowSnapshotConnection[] = this.connections.map(connection => ({
      from: connection.from,
      to: connection.to,
      port: connection.port
    }));

    return {
      generatedAt: new Date().toISOString(),
      nodes,
      connections
    };
  }

  private applyFlowSnapshot(snapshot: FlowSnapshot): void {
    const dynamicNodes = snapshot.nodes.filter((node): node is FlowSnapshotNode & {
      id: number;
      type: 'condition' | 'destination';
    } => this.isDynamicSnapshotNode(node));

    const normalizedNodes: SmartFlowNode[] = dynamicNodes.map(node => ({
      id: node.id,
      type: node.type,
      label: node.label,
      x: node.position?.x ?? SmartFlowComponent.NODE_MARGIN,
      y: Math.max(
        node.position?.y ?? SmartFlowComponent.CANVAS_TOP_OFFSET,
        SmartFlowComponent.CANVAS_TOP_OFFSET
      ),
      metadata: (node.metadata as ConditionMetadata | undefined) ?? undefined
    }));

    const maxId = normalizedNodes.reduce((max, node) => Math.max(max, node.id), 0);
    this.nodeIdCounter = maxId + 1;

    this.nodes = normalizedNodes;

    this.connections = snapshot.connections.map((connection, index) => ({
      id: index + 1,
      from: connection.from,
      to: connection.to,
      port: connection.port
    }));
    this.connectionIdCounter = this.connections.length + 1;

    const defaultDestination = snapshot.nodes.find(
      node => node.type === 'default-destination'
    );
    const defaultMetadata = defaultDestination?.metadata as DefaultDestinationMetadata | undefined;
    this.defaultDestinationUrl = defaultMetadata?.url ?? '';

    this.connectionPreview = null;
    this.connectionDragSource = null;
    this.draggingNodeId = null;
    this.showConditionConfig = false;
    this.showDestinationConfig = false;
    this.editingDefaultDestination = false;
    this.updateSimulationPreview();
  }

  private loadSavedFlowsFromStorage(): void {
    try {
      const raw = localStorage.getItem(SmartFlowComponent.STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as SavedFlow[];
      if (Array.isArray(parsed)) {
        this.savedFlows = parsed;
      }
    } catch (error) {
      console.error('Failed to load saved flows from storage', error);
    }
  }

  private persistSavedFlows(): void {
    try {
      localStorage.setItem(
        SmartFlowComponent.STORAGE_KEY,
        JSON.stringify(this.savedFlows)
      );
    } catch (error) {
      console.error('Failed to persist saved flows', error);
    }
  }

  private isDynamicSnapshotNode(
    node: FlowSnapshotNode
  ): node is FlowSnapshotNode & { id: number; type: 'condition' | 'destination' } {
    return (
      (node.type === 'condition' || node.type === 'destination') &&
      typeof node.id === 'number'
    );
  }

  getConditionNodes(): SmartFlowNode[] {
    return this.nodes.filter(node => node.type === 'condition');
  }

  getValueOptions(criteria?: string): CriteriaOption[] {
    if (!criteria) {
      return [];
    }
    return this.criteriaValueMap[criteria as CriteriaKey] ?? [];
  }

  getDestinationUrl(node: SmartFlowNode): string | null {
    if (node.type !== 'destination') {
      return null;
    }
    const metadata = node.metadata as DestinationMetadata | undefined;
    return metadata?.destinationUrl ?? null;
  }
}

type CriteriaKey = 'day' | 'country' | 'device-language' | 'device-os';
type OperatorKey = 'is' | 'is-not';
type ConnectionPort = 'success' | 'danger';
type NodeIdentifier = number | 'default-source' | 'default-destination';
type SpecialNodeIdentifier = 'default-source' | 'default-destination';

interface CriteriaOption {
  value: string;
  label: string;
}

interface SmartFlowNode {
  id: number;
  type: 'condition' | 'destination';
  label: string;
  x: number;
  y: number;
  metadata?: ConditionMetadata | DestinationMetadata;
}

interface SmartFlowConnection {
  id: number;
  from: NodeIdentifier;
  to: NodeIdentifier;
  port: ConnectionPort;
}

interface ConnectionDragSource {
  nodeId: NodeIdentifier;
  port: ConnectionPort;
}

interface ConnectionPoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  port: ConnectionPort;
  from?: NodeIdentifier;
}

type ConnectionPreview = ConnectionPoints;

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FlowSnapshot {
  generatedAt: string;
  nodes: FlowSnapshotNode[];
  connections: FlowSnapshotConnection[];
}

interface FlowSnapshotNode {
  id: NodeIdentifier;
  type: 'condition' | 'destination' | 'default-source' | 'default-destination';
  label: string;
  position?: { x: number; y: number };
  metadata?: ConditionMetadata | DefaultDestinationMetadata | DestinationMetadata | null;
}

interface FlowSnapshotConnection {
  from: NodeIdentifier;
  to: NodeIdentifier;
  port: ConnectionPort;
}

interface SavedFlow {
  id: string;
  name: string;
  snapshot: FlowSnapshot;
}

interface SimulationResult {
  timestamp: string;
  payload: unknown;
  destination: SimulationDestination;
}

interface SimulationDestination {
  label: string;
  url?: string | null;
}

interface DestinationMetadata {
  destinationUrl?: string | null;
}

interface ConditionMetadata {
  criteria: CriteriaKey;
  operator: OperatorKey;
  value: string;
  label: string;
}

interface DefaultDestinationMetadata {
  url?: string | null;
}

interface SimulationPreviewPayload {
  generatedAt: string;
  attributes: Record<string, string>;
}
