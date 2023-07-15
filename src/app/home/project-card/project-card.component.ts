import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-project-card',
  templateUrl: './project-card.component.html',
  styleUrls: ['./project-card.component.scss'],
})
export class ProjectCardComponent {
  @Input() title!: string;
  @Input() description!: string;
  @Input() imageURL!: string;
  @Input() techList!: string[];
  @Input() projectURL!: string;
}
